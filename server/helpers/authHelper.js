const { OAuth2Client } = require("google-auth-library");
const { redisHelper } = require("./redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Verifies a Google ID token and extracts user info.
 * @param {String} token The Google ID token.
 * @returns {Promise<{userId: String, name: String}>}
 * @throws If the token is invalid or verification fails.
 */
const verifyGoogleToken = async (token) => {
  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken: token });
    const payload = ticket.getPayload();

    if (!payload || !payload["sub"]) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Invalid Google token payload",
        401
      );
    }

    return { userId: payload["sub"], name: payload["name"] || "" };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to verify Google token",
      401
    );
  }
};

/**
 * Verifies a Facebook access token and extracts user info.
 * @param {String} token The Facebook access token.
 * @returns {Promise<{userId: String, name: String}>}
 * @throws If the token is invalid or verification fails.
 */
const verifyFacebookToken = async (token) => {
  try {
    const url = new URL(process.env.FACEBOOK_TOKEN_DEBUG_URL);
    url.searchParams.append("input_token", token);
    url.searchParams.append(
      "access_token",
      `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );

    const response = await fetch(url.href);
    if (!response.ok) {
      throw new AppError(
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        "Failed to verify Facebook access token",
        401
      );
    }
    const data = await response.json();
    if (!data || data.data.error || !data.data.user_id) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Invalid Facebook token",
        401
      );
    }

    return {
      userId: data.data.user_id,
      name: data.data.name || "",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to verify Facebook token",
      401
    );
  }
};

/**
 * Extracts a Bearer token from the Authorization header of a request.
 * @param {Object} req Express request object.
 * @returns {String} The extracted token.
 * @throws If the header is missing or malformed.
 */
const extractFromAuthHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "Missing or invalid Authorization header",
      401
    );
  }
  return authHeader.split(" ")[1];
};

/**
 * Refreshes the session TTL in Redis and updates the 'expires_at' field in the database.
 * @param {"auth"|"anon"} sessionType The type of session.
 * @param {String} sessionId The session ID.
 * @returns {Promise<void>}
 * @throws If the session type is unknown.
 */
const refreshSessionTTL = async (sessionType, sessionId) => {
  try {
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
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Unknown session type",
        400
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      "Failed to refresh session TTL"
    );
  }
};

const authHelper = {
  verifyGoogleToken,
  verifyFacebookToken,
  extractFromAuthHeader,
  refreshSessionTTL,
};

module.exports = authHelper;
