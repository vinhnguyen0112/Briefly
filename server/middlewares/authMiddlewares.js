const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const AnonSession = require("../models/anonSession");
// Verify the origin of the request
const verifyOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  // Request from our Chrome extension
  if (origin && origin === `chrome-extension://${process.env.EXTENSION_ID}`) {
    console.log("Request origin is valid, proceeding.");
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Unauthorized request from invalid origin.",
  });
};

// Validate the session and determine its type
const validateSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractFromAuthHeader(req);
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Missing session ID",
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
      return res.status(401).json({
        success: false,
        message: "Invalid session ID format",
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

    // Cache not found, fallback to DB
    if (isAuth) {
      const authSession = await Session.getById(actualId);
      if (!authSession || !authSession.user_id) {
        return res.status(401).json({
          success: false,
          message: "Session not found or type mismatch",
        });
      }

      console.log("Persisted auth session found: ", authSession);

      // Update cache
      await redisHelper.createSession(actualId, authSession);
      req.session = authSession;
      return next();
    } else {
      const anonSession = await AnonSession.getById(actualId);
      if (!anonSession) {
        return res.status(401).json({
          success: false,
          message: "Session not found or type mismatch",
        });
      }

      console.log("Persisted anon session found: ", anonSession);

      // Update cache
      await redisHelper.createAnonSession(actualId, anonSession);
      req.session = anonSession;
      return next();
    }
  } catch (err) {
    console.error("Error in validateSession middleware:", err);
    return next(err);
  }
};

module.exports = { verifyOrigin, validateSession };
