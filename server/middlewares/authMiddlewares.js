const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
const { generateHash } = require("../helpers/commonHelper");

// Validate the session and determine its type
const validateSession = async (req, res, next) => {
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

    // Determine session type
    let actualId, isAuth;
    if (sessionId.startsWith("auth:")) {
      isAuth = true;
      actualId = sessionId.slice("auth:".length);
      req.sessionType = "auth";
    } else if (sessionId.startsWith("anon:")) {
      isAuth = false;
      actualId = sessionId.slice("anon:".length);
      req.sessionType = "anon";
    } else {
      console.log("Session ID format invalid: ", sessionId);
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_FORMAT_INVALID",
          message: "Invalid session ID format",
        },
      });
    }

    // Check Redis cache
    let cached;
    if (isAuth) {
      cached = await redisHelper.getSession(actualId);
    } else {
      cached = await redisHelper.getAnonSession(actualId);
    }
    if (cached) {
      console.log("Cached session hit: ", cached);
      req.session = cached;
      return next();
    }

    console.log("Cache miss for session ID: ", actualId);
    console.log("Checking in database...");
    // Cache not found, fallback to DB
    if (isAuth) {
      const authSession = await Session.getById(actualId);
      if (!authSession || !authSession.user_id) {
        console.log("Auth session not found or type mismatch: ", authSession);
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_SESSION_INVALID",
            message: "Session not found or type mismatch",
          },
        });
      }

      console.log("Persisted auth session found: ", authSession);

      // Update cache
      await redisHelper.createSession(actualId, authSession);
      req.session = authSession;
      return next();
    } else {
      const anonSession = await AnonSession.getById(actualId);
      // If no anon session found, create a new anon session to continue flow
      if (!anonSession) {
        console.log("No anon session found in DB, creating new.");
        const { clientIp, visitorId } = req;
        const anonSessionId = generateHash(visitorId, clientIp);
        await AnonSession.create({
          id: anonSessionId,
          anon_query_count: 0,
        });
        await redisHelper.createAnonSession(anonSessionId, {
          anon_query_count: 0,
        });
        req.newAnonSessionAssigned = true;
        req.session = {
          id: anonSessionId,
          anon_query_count: 0,
        };

        return next();
      }

      console.log("Persisted anon session found: ", anonSession);

      // Update cache
      await redisHelper.createAnonSession(actualId, anonSession);
      req.session = anonSession;
      return next();
    }
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

// Attach new anon session to response if created during validation
const attachNewAnonSession = async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Only add fields if a new anon session was created
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

module.exports = { validateSession, attachNewAnonSession };
