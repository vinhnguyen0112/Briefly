const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const SERVER_URL = "http://localhost:3000";

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

const extractIdToken = (redirectedTo) => {
  const redirectedUrl = new URL(redirectedTo);
  const params = new URLSearchParams(redirectedUrl.hash.replace("#", ""));
  const idToken = params.get("id_token");

  if (!idToken) {
    throw new Error("ID token not found in authentication response");
  }

  return idToken;
};

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

  return data.data;
};
