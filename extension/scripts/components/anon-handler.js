import { saveAnonSession, sendRequest } from "./state.js";
import FingerprintJS from "../../libs/fingerprint.js";

// Loads FingerprintJS and gets the visitorId
export async function getFingerprint() {
  const fp = await FingerprintJS.load();
  const { visitorId } = await fp.get();

  return visitorId;
}

// Requests a new anon session from the server
async function requestAnonSession(visitorId) {
  const response = await sendRequest("http://localhost:3000/api/anon", {
    method: "POST",
    headers: {
      visitor: visitorId,
    },
    withSession: false,
  });

  return response.data;
}

// Request an anon session from the server
export async function setupAnonSession() {
  try {
    const visitorId = await getFingerprint();
    const data = await requestAnonSession(visitorId);
    return await saveAnonSession(data);
  } catch (error) {
    throw error;
  }
}
