import { saveAnonSession } from "./state.js";
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

// Request an anon session from the server
// This function will not check for existing anon session
export async function setupAnonSession() {
  try {
    const visitorId = await getFingerprintVisitorId();
    const data = await requestAnonSession(visitorId);
    return await saveAnonSession(data);
  } catch (error) {
    throw error;
  }
}
