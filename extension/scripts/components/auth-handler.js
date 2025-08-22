import { clearUserSession, getAnonSession, getUserSession } from "./state.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const FACEBOOK_AUTH_URL = "https://www.facebook.com/v22.0/dialog/oauth";
const SERVER_URL = "http://localhost:3000";

/**
 * Checks if the user is authenticated and if the session is valid.
 * @returns {Promise<{isAuth: boolean, isValid: boolean}>}
 */
export const isUserAuthenticated = async () => {
  try {
    const session = await getUserSession();
    if (!session) {
      return {
        isAuth: false,
        isValid: false,
      };
    }
    const isValid = await isSessionValid(session.id);
    return {
      isAuth: true,
      isValid,
    };
  } catch (err) {
    console.error(err);
  }
};

/**
 * Validates if the authentication session is still valid on the server.
 * @param {string} sessionId The session ID to validate.
 * @returns {Promise<boolean>} True if valid, false otherwise.
 */
export const isSessionValid = async (sessionId) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/session-validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer auth:${sessionId}`,
      },
    });

    const data = await response.json();
    return data.success === true;
  } catch (err) {
    // If validation endpoint is unreachable, keep user authenticated
    // Further requests will invalidate them
    if (err instanceof TypeError) {
      console.error("Validation endpoint is unreachable");
      return true;
    } else {
      console.error(err);
      throw err;
    }
  }
};

/**
 * Signs the user out and clears the session.
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    const session = await getUserSession();
    // If there's no auth session on going, sign out anyway
    if (!session) {
      return await clearUserSession();
    }

    const response = await fetch(`${SERVER_URL}/api/auth/signout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer auth:${session.id}`,
      },
    });

    if (!response.ok) {
      throw new Error("Signout request failed");
    }

    // Clear user session in storage
    return await clearUserSession();
  } catch (err) {
    throw err;
  }
};

/**
 * Initiates Facebook authentication flow and returns session data.
 * @returns {Promise<Object>} The authenticated session data.
 * @throws If authentication fails.
 */
export const authenticateWithFacebook = async () => {
  const manifest = chrome.runtime.getManifest();

  try {
    const authUrl = buildFacebookAuthUrl(manifest);
    const redirectedTo = await launchAuthFlow(authUrl);
    const accessToken = extractAccessToken(redirectedTo);

    console.log(
      "Facebook authentication successful, sending access token to server"
    );

    const sessionData = await sendAccessTokenToServer(accessToken);
    return sessionData;
  } catch (error) {
    console.error("Error during Facebook authentication:", error.message);
    throw error;
  }
};

/**
 * Builds the Facebook OAuth URL using manifest data.
 * @param {Object} manifest The Chrome extension manifest.
 * @returns {string} The Facebook OAuth URL.
 */
const buildFacebookAuthUrl = (manifest) => {
  const url = new URL(FACEBOOK_AUTH_URL);
  url.searchParams.set("client_id", manifest.oauth2.facebook_client_id);
  url.searchParams.set(
    "redirect_uri",
    `https://${chrome.runtime.id}.chromiumapp.org`
  );
  url.searchParams.set("response_type", "token");
  return url.href;
};

/**
 * Extracts the access token from the redirected Facebook OAuth URL.
 * @param {string} redirectedTo The redirected URL after authentication.
 * @returns {string} The access token.
 * @throws If the access token is not found.
 */
const extractAccessToken = (redirectedTo) => {
  const redirectedUrl = new URL(redirectedTo);
  const params = new URLSearchParams(redirectedUrl.hash.replace("#", ""));
  const accessToken = params.get("access_token");

  if (!accessToken) {
    throw new Error("Access token not found in authentication response");
  }

  return accessToken;
};

/**
 * Sends the Facebook access token to the server for verification and session creation.
 * @param {string} accessToken The Facebook access token.
 * @returns {Promise<Object>} The session data from the server.
 * @throws If the server responds with an error.
 */
const sendAccessTokenToServer = async (accessToken) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(`${SERVER_URL}/api/auth/facebook/callback`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      "Failed to initiate tokens: " + (data.error || "Unknown error")
    );
  }

  return data;
};

/**
 * Initiates Google authentication flow and returns session data.
 * @returns {Promise<Object>} The authenticated session data.
 * @throws If authentication fails.
 */
export const authenticateWithGoogle = async () => {
  const manifest = chrome.runtime.getManifest();

  try {
    const authUrl = buildGoogleAuthUrl(manifest);
    const redirectedTo = await launchAuthFlow(authUrl);
    const idToken = extractIdToken(redirectedTo);

    console.log("Google authentication successful, sending ID token to server");

    const sessionData = await sendIdTokenToServer(idToken);
    return sessionData;
  } catch (error) {
    console.error("Error during Google authentication:", error.message);
    throw error;
  }
};

/**
 * Builds the Google OAuth URL using manifest data.
 * @param {Object} manifest The Chrome extension manifest.
 * @returns {string} The Google OAuth URL.
 */
const buildGoogleAuthUrl = (manifest) => {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", manifest.oauth2.client_id);
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set(
    "redirect_uri",
    `https://${chrome.runtime.id}.chromiumapp.org`
  );
  url.searchParams.set("scope", manifest.oauth2.scopes.join(" "));
  return url.href;
};

/**
 * Launches the Chrome identity WebAuthFlow for OAuth.
 * @param {string} authUrl The OAuth URL to launch.
 * @returns {Promise<string>} The redirected URL after authentication.
 */
const launchAuthFlow = (authUrl) => {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectedUrl) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              "Failed to authenticate: " + chrome.runtime.lastError.message
            )
          );
        } else {
          resolve(redirectedUrl);
        }
      }
    );
  });
};

/**
 * Extracts the ID token from the redirected Google OAuth URL.
 * @param {string} redirectedTo The redirected URL after authentication.
 * @returns {string} The ID token.
 * @throws If the ID token is not found.
 */
const extractIdToken = (redirectedTo) => {
  const redirectedUrl = new URL(redirectedTo);
  const params = new URLSearchParams(redirectedUrl.hash.replace("#", ""));
  const idToken = params.get("id_token");

  if (!idToken) {
    throw new Error("ID token not found in authentication response");
  }

  return idToken;
};

/**
 * Sends the Google ID token to the server for verification and session creation.
 * @param {string} idToken The Google ID token.
 * @returns {Promise<Object>} The session data from the server.
 * @throws If the server responds with an error.
 */
const sendIdTokenToServer = async (idToken) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };

  const response = await fetch(`${SERVER_URL}/api/auth/google/callback`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      "Failed to initiate tokens: " + (data.error || "Unknown error")
    );
  }

  return data;
};
