const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const { generateHash } = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Resolve provided session into session type and actual ID
 * @param {String} sessionId
 */
async function resolveSessionId(sessionId) {
  console.log("sessionId raw:", sessionId);

  const match = /^(auth|anon):([a-zA-Z0-9_-]+)$/.exec(sessionId);

  console.log("match result:", match);

  if (!match) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid session ID format");
  }

  const type = match[1];
  const actualId = match[2];

  return { type, actualId };
}

// Look up session in Redis and MariaDB
async function lookupSession(actualId, type) {
  if (type === "auth") {
    // Look inside Redis first
    let cached = await redisHelper.getSession(actualId);
    if (cached) return cached;

    // Fallback to MariaDB if not found
    const fromDb = await Session.getById(actualId);
    if (!fromDb) return null;

    // Update cache
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

const validateSession = async (req, res, next) => {
  try {
    // Extract session from auth header
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = await resolveSessionId(sessionId);

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

// Verify session ID and make sure only authenticated session is allowed
const requireAuthenticatedSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing session ID", 401);
    }

    const parsed = await resolveSessionId(sessionId);

    if (parsed.type !== "auth") {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Only authenticated sessions are allowed",
        401
      );
    }

    let sessionData = await lookupSession(parsed.actualId, "auth");

    if (!sessionData) {
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
