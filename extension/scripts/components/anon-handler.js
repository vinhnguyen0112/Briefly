// Loads FingerprintJS and gets the visitorId
async function getFingerprintVisitorId() {
  // Dynamically import the ESM build
  const { default: FingerprintJS } = await import("../../libs/fingerprint.js");

  // Load the agent and fetch the visitor ID
  const fp = await FingerprintJS.load();
  const { visitorId } = await fp.get();

  return visitorId;
}

// Requests a new anon session from the server
async function requestAnonSession(visitorId) {
  const response = await fetch("http://localhost:3000/api/anon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  if (!response.ok) throw new Error("Network response was not ok");
  return response.json();
}

// Saves anon session data to chrome.storage
function saveAnonSessionToStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        anon_session_id: data.anonSessionId,
        anon_query_count: data.anon_query_count,
      },
      () => resolve(data.anonSessionId)
    );
  });
}

// Main function to get anon session id
export const getAnonSessionId = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["anon_session_id"], async (result) => {
      if (result.anon_session_id) {
        resolve(result.anon_session_id);
      } else {
        try {
          const visitorId = await getFingerprintVisitorId();
          const data = await requestAnonSession(visitorId);
          const sessionId = await saveAnonSessionToStorage(data);
          resolve(sessionId);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
};
