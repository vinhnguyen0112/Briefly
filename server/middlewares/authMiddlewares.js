const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Parses a session ID string and extracts the session type and actual ID.
 * @param {String} sessionId The session ID with type prefix "auth:" or "anon:"
 * @returns {{type: String, actualId: String}} The session type and actual ID.
 * @throws  If the session ID format is invalid.
 */
function resolveSessionId(sessionId) {
  const match = /^(auth|anon):([a-zA-Z0-9_-]+)$/.exec(sessionId);

  if (!match) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "Invalid session ID format",
      401
    );
  }

  const type = match[1];
  const actualId = match[2];

  return { type, actualId };
}

/**
 * Looks up a session in Redis and falls back to MariaDB if not found.
 * Updates the cache if found in the database.
 * @param {String} actualId The actual session ID.
 * @param {String} type The session type ("auth" or "anon").
 * @returns {Promise<Object|null>} The session data or null if not found.
 */
async function lookupSession(actualId, type) {
  if (type === "auth") {
    // Try to get in Redis
    let cached = await redisHelper.getSession(actualId, "auth");
    if (cached) return cached;

    // Try to get from MariaDB
    const fromDb = await Session.getById(actualId);
    if (!fromDb) return null;

    // Update cache
    await redisHelper.createSession(
      {
        id: actualId,
        ...fromDb,
      },
      "auth"
    );
    return fromDb;
  } else {
    // Try to get in Redis
    let cached = await redisHelper.getSession(actualId, "anon");
    if (cached) return cached;

    // Try to get from MariaDB
    const fromDb = await AnonSession.getById(actualId);
    if (!fromDb) return null;

    // Update cache
    await redisHelper.createSession(
      {
        id: actualId,
        ...fromDb,
      },
      "anon"
    );
    return fromDb;
  }
}

/**
 * Checks whether a session needs to be refreshed. If needed, refresh it in both MariaDB and Redis
 * @param {String} id The actual session ID (without prefix)
 * @param {"auth"|"anon"} type Session type
 * @param {Object} sessionData The session data object (from Redis or MariaDB)
 * @returns {Promise<void>}
 */
async function refreshSessionIfNeeded(id, type, sessionData) {
  try {
    // Strip off expires_at
    const { expires_at, ...cleanedSessionData } = sessionData;
    const REFRESH_THRESHOLD = 86400; // 1 day

    let redisTtl = await redisHelper.getSessionTTL(id, type);

    if (redisTtl !== null && redisTtl < REFRESH_THRESHOLD) {
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (type === "auth") {
        await Session.update(id, { expires_at: newExpiresAt });
        await redisHelper.createSession({ id, ...cleanedSessionData }, "auth");
      } else {
        await AnonSession.update(id, { expires_at: newExpiresAt });
        await redisHelper.createSession({ id, ...cleanedSessionData }, "anon");
      }
    }
  } catch (err) {
    console.error("Error refreshing session TTL:", err);
    // Failed to refresh is non-critical, continue the flow if failed
  }
}

/**
 * Middleware to validate a session from the Authorization header.
 * Throws an error if the session is not found or invalid.
 * Sets req.sessionType and req.session.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const validateSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = resolveSessionId(sessionId);

    let sessionData = await lookupSession(parsed.actualId, parsed.type);

    // Refresh if needed
    if (sessionData) {
      await refreshSessionIfNeeded(parsed.actualId, parsed.type, sessionData);
    }

    // Session not found - reject regardless of type
    if (!sessionData) {
      if (parsed.type === "auth") {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          "Session not found or invalid",
          401
        );
      } else {
        throw new AppError(
          ERROR_CODES.UNAUTHENTICATED,
          "Session not found or invalid",
          401
        );
      }
    }

    req.sessionType = parsed.type;
    req.session = sessionData;
    return next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware to require an authenticated session.
 * Only allows sessions of type "auth".
 * Sets req.sessionType and req.session.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const requireAuthenticatedSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = resolveSessionId(sessionId);

    if (parsed.type !== "auth") {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Only authenticated sessions are allowed",
        401
      );
    }

    let sessionData = await lookupSession(parsed.actualId, "auth");

    if (sessionData) {
      await refreshSessionIfNeeded(parsed.actualId, "auth", sessionData);
    }

    if (!sessionData || !sessionData.user_id) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Authenticated session not found or invalid",
        401
      );
    }

    req.sessionType = "auth";
    req.session = sessionData;
    return next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateSession,
  requireAuthenticatedSession,
};
