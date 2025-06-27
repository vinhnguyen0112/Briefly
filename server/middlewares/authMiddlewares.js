const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const { generateHash } = require("../helpers/commonHelper");

// Extract session ID value and session type
async function resolveSessionId(sessionId) {
  let actualId, type;

  if (sessionId.startsWith("auth:")) {
    type = "auth";
    actualId = sessionId.slice("auth:".length);
  } else if (sessionId.startsWith("anon:")) {
    type = "anon";
    actualId = sessionId.slice("anon:".length);
  } else {
    throw new Error("SESSION_HEADER_FORMAT_INVALID");
  }

  return { type, actualId };
}

// Look up session in Redis and MariaDB
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

const validateSession = async (req, res, next) => {
  try {
    // Extract session ID from auth header
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_SESSION_ID",
          message: "Missing session ID",
        },
      });
    }

    let parsed;
    try {
      parsed = await resolveSessionId(sessionId);
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_HEADER_FORMAT_INVALID",
          message: "Invalid session ID format",
        },
      });
    }

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
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_SESSION_INVALID",
          message: "Authenticated session not found or invalid",
        },
      });
    }

    // Session is valid, attach along request
    req.sessionType = parsed.type;
    req.session = sessionData;
    return next();
  } catch (err) {
    console.error("Error in validateSession middleware:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "SESSION_VALIDATION_ERROR",
        message: "Internal error during session validation",
        details: err.message,
      },
    });
  }
};

// Verify session ID and make sure only authenticated session is allowed
const requireAuthenticatedSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_SESSION_ID",
          message: "Missing session ID",
        },
      });
    }

    let parsed;
    try {
      parsed = await resolveSessionId(sessionId);
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_HEADER_FORMAT_INVALID",
          message: "Invalid session ID format",
        },
      });
    }

    if (parsed.type !== "auth") {
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_NOT_AUTH",
          message: "Only authenticated sessions are allowed",
        },
      });
    }

    let sessionData = await lookupSession(parsed.actualId, "auth");

    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTH_SESSION_INVALID",
          message: "Authenticated session not found or invalid",
        },
      });
    }

    req.sessionType = "auth";
    req.session = sessionData;
    return next();
  } catch (err) {
    console.error("Error in requireAuthenticatedSession middleware:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "SESSION_VALIDATION_ERROR",
        message: "Internal error during session validation",
        details: err.message,
      },
    });
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
