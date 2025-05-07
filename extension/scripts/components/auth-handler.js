import { clearUserSession, getUserSession } from "./state.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const FACEBOOK_AUTH_URL = "https://www.facebook.com/v22.0/dialog/oauth";
const SERVER_URL = "http://localhost:3000";

// Check if user is authenticated on server
export const isUserAuthenticated = async () => {
  try {
    // Check for ongoing session
    const sessionId = await getUserSession();
    console.log("Session ID: ", sessionId);
    if (!sessionId) {
      return false;
    }

    // Check for session validity
    const isValid = await isSessionValid(sessionId);
    return isValid;
  } catch (err) {
    console.error(err);
  }
};

// Validate the user session on server
const isSessionValid = async (sessionId) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/session-validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    console.log(data);
    return data.success;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// Sign the user out
export const signOut = async () => {
  try {
    const sessionId = await getUserSession();
    if (!sessionId) throw new Error("Session ID not found.");

    // Sign user out on server side first
    const response = await fetch(`${SERVER_URL}/api/auth/signout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
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

export const authenticateWithFacebook = async () => {
  const manifest = chrome.runtime.getManifest();

  try {
    const authUrl = buildFacebookAuthUrl(manifest);
    const redirectedTo = await launchAuthFlow(authUrl);

    console.log("Facebook redirected URL: ", redirectedTo);

    const accessToken = extractAccessToken(redirectedTo);

    console.log("Access Token: ", accessToken);
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

// Configure the Faccebook authentication endpoints
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

// Extract token from redirected URL
const extractAccessToken = (redirectedTo) => {
  const redirectedUrl = new URL(redirectedTo);
  const params = new URLSearchParams(redirectedUrl.hash.replace("#", ""));
  const accessToken = params.get("access_token");

  if (!accessToken) {
    throw new Error("Access token not found in authentication response");
  }

  return accessToken;
};

// Send token to server for verification & session
const sendAccessTokenToServer = async (accessToken) => {
  const response = await fetch(`${SERVER_URL}/api/auth/facebook/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  const data = await response.json();
  console.log("Server response:", data);

  if (!data.success) {
    throw new Error(
      "Failed to initiate tokens: " + (data.error || "Unknown error")
    );
  }

  return data.sessionId;
};

// Google authentication communication
export const authenticateWithGoogle = async () => {
  console.log("Authenticating with Google function executed");
  const manifest = chrome.runtime.getManifest();

  try {
    const authUrl = buildGoogleAuthUrl(manifest);
    const redirectedTo = await launchAuthFlow(authUrl);
    const idToken = extractIdToken(redirectedTo);

    console.log("ID Token: ", idToken);
    console.log("Google authentication successful, sending ID token to server");

    const sessionData = await sendIdTokenToServer(idToken);
    return sessionData;
  } catch (error) {
    console.error("Error during Google authentication:", error.message);
    throw error;
  }
};

// Configure Google authentication endpoints
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

// Extract ID token from redirectedURL
const extractIdToken = (redirectedTo) => {
  const redirectedUrl = new URL(redirectedTo);
  const params = new URLSearchParams(redirectedUrl.hash.replace("#", ""));
  const idToken = params.get("id_token");

  if (!idToken) {
    throw new Error("ID token not found in authentication response");
  }

  return idToken;
};

// Send ID token to server for verification & session
const sendIdTokenToServer = async (idToken) => {
  const response = await fetch(`${SERVER_URL}/api/auth/google/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  const data = await response.json();
  console.log("Server response:", data);

  if (!data.success) {
    throw new Error(
      "Failed to initiate tokens: " + (data.error || "Unknown error")
    );
  }

  return data.sessionId;
};
