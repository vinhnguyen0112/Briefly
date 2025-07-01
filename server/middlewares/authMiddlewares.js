const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const { generateHash } = require("../helpers/commonHelper");
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
    throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid session ID format");
  }

  const type = match[1];
  const actualId = match[2];

  return { type, actualId };
}

/**
 * Looks up a session in Redis and falls back to MariaDB if not found.
 * Updates the cache if found in the database.
 * @param {string} actualId The actual session ID.
 * @param {string} type The session type ("auth" or "anon").
 * @returns {Promise<Object|null>} The session data or null if not found.
 */
async function lookupSession(actualId, type) {
  if (type === "auth") {
    let cached = await redisHelper.getSession(actualId);
    if (cached) return cached;

    const fromDb = await Session.getById(actualId);
    if (!fromDb) return null;

    await redisHelper.createSession(actualId, fromDb);
    return fromDb;
  } else {
    let cached = await redisHelper.getAnonSession(actualId);
    if (cached) return cached;

    const fromDb = await AnonSession.getById(actualId);
    if (!fromDb) return null;

    await redisHelper.createAnonSession(actualId, fromDb);
    return fromDb;
  }
}

/**
 * Middleware to validate a session from the Authorization header.
 * If the session is anonymous and invalid, assigns a new anonymous session.
 * Sets req.sessionType and req.session.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const validateSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = resolveSessionId(sessionId);

    let sessionData = await lookupSession(parsed.actualId, parsed.type);

    // If anonymous session is invalid, assign user a new one
    if (!sessionData && parsed.type === "anon") {
      const { clientIp, visitorId } = req;
      const anonSessionId = generateHash(visitorId, clientIp);

      await AnonSession.create({ id: anonSessionId, anon_query_count: 0 });
      await redisHelper.createAnonSession(anonSessionId, {
        anon_query_count: 0,
      });

      req.sessionType = "anon";
      req.session = { id: anonSessionId, anon_query_count: 0 };
      req.newAnonSessionAssigned = true;
      return next();
    }

    // If user authenticated session is invalid
    if (!sessionData && parsed.type === "auth") {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Authenticated session not found or invalid",
        401
      );
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
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const requireAuthenticatedSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = resolveSessionId(sessionId);
    console.log("Parsed: ", parsed);

    if (parsed.type !== "auth") {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Only authenticated sessions are allowed",
        401
      );
    }

    let sessionData = await lookupSession(parsed.actualId, "auth");

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

/**
 * Middleware to attach metadata about a newly assigned anonymous session to the response.
 * Adds meta.newAnonSessionAssigned and meta.newAnonSession to the response body if applicable.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const attachNewAnonSession = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (req.newAnonSessionAssigned && req.session) {
      body = {
        ...body,
        meta: {
          ...(body.meta || {}),
          newAnonSessionAssigned: true,
          newAnonSession: req.session,
        },
      };
    }
    return originalJson(body);
  };

  next();
};

module.exports = {
  validateSession,
  requireAuthenticatedSession,
  attachNewAnonSession,
};
