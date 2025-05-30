const { OAuth2Client } = require("google-auth-library");
const { redisHelper } = require("./redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");

const client = new OAuth2Client();

// Verify google ID token
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
    });
    const payload = ticket.getPayload();

    console.log("Payload: ", payload);

    return { userId: payload["sub"], name: payload["name"] || "" };
  } catch (error) {
    throw error;
  }
};

const verifyFacebookToken = async (token) => {
  const url = new URL(process.env.FACEBOOK_TOKEN_DEBUG_URL);
  url.searchParams.append("input_token", token);
  url.searchParams.append(
    "access_token",
    `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
  );

  const response = await fetch(url.href);
  if (!response.ok) {
    throw new Error("Failed to verify access token");
  }
  const data = await response.json();
  if (!data || data.data.error) {
    throw new Error("Invalid access token");
  }

  console.log("Response from Facebook token debug:", data);
  return {
    userId: data.data.user_id,
    name: data.data.name || "",
  };
};

// Helper function to extract from Authorization header
const extractFromAuthHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  const token = authHeader.split(" ")[1];
  console.log("Extracted token: ", token);
  return token;
};

// Helper function to extract from promotion header
const extractFromPromotionHeader = (req) => {
  const anonSessionId = req.headers["promote"];

  return anonSessionId;
};

// Refresh session TTL in Redis & 'expires_at' in MariaDB
const refreshSessionTTL = async (sessionType, sessionId) => {
  console.log("Refreshing session:", sessionId);

  const ttlSeconds = parseInt(process.env.SESSION_TTL, 10);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  if (sessionType === "auth") {
    await redisHelper.refreshSession(sessionId);
    await Session.update(sessionId, { expires_at: expiresAt });
  } else if (sessionType === "anon") {
    await redisHelper.refreshAnonSession(sessionId);
    await AnonSession.update(sessionId, { expires_at: expiresAt });
  } else {
    throw new Error("Unknown session type");
  }
};

const authHelper = {
  verifyGoogleToken,
  verifyFacebookToken,
  extractFromAuthHeader,
  extractFromPromotionHeader,
  refreshSessionTTL,
};

module.exports = authHelper;
