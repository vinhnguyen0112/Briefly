const authHelper = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session"); // Assuming this is your database model for sessions

// Verify the origin of the request to ensure it's from our Chrome extension
const verifyOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  // It's generally better to check for exact match after ensuring origin exists
  if (origin && origin === `chrome-extension://${process.env.EXTENSION_ID}`) {
    console.log("The request origin is valid.");
    return next();
  }

  // Use a more specific error or status code if possible, e.g., 403 Forbidden
  return res.status(403).json({
    success: false,
    message: "Unauthorized request from invalid origin.",
  });
};

// Validate the session and determine its type
const validateSession = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractAuthToken(req);

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Missing session ID",
      });
    }

    // Determine session type based on prefix
    let isAuthSession = false;
    let actualSessionId = sessionId;

    if (sessionId.startsWith("auth:")) {
      isAuthSession = true;
      actualSessionId = sessionId.substring("auth:".length);
      req.sessionType = "auth";
    } else if (sessionId.startsWith("anon:")) {
      isAuthSession = false;
      actualSessionId = sessionId.substring("anon:".length);
      req.sessionType = "anon";
    } else {
      console.error(
        "Session ID has an unknown prefix or no prefix:",
        sessionId
      );
      return res.status(401).json({
        success: false,
        message: "Invalid session ID format.",
      });
    }

    // Look up cached sessions in Redis
    const key = `${req.sessionType}:${actualSessionId}`;
    const cachedSession = await redisHelper.getSession(key);

    // If found in cache
    if (cachedSession) {
      req.session = cachedSession;
      return next();
    }
    // If not found in cache
    else {
      // Check in db
      const persistedSession = await Session.getById(actualSessionId);
      // If found
      if (persistedSession) {
        // Session type mismatch -> Reject
        if (
          (isAuthSession && !persistedSession.user_id) ||
          (!isAuthSession && persistedSession.user_id)
        ) {
          return res
            .status(401)
            .json({ success: false, message: "Session type mismatch" });
        }

        // Update cache
        await redisHelper.createSession(persistedSession.id, {
          user_id: persistedSession.user_id,
        });
        req.session = persistedSession;
        return next();
      }
      // If not found
      else {
        return res.status(401).json({
          success: false,
          message: "Session doesn't exist or has expired.",
        });
      }
    }
  } catch (err) {
    console.error("Error in validateSession middleware:", err);
    return next(err); // Pass error to Express error handling middleware
  }
};

module.exports = { verifyOrigin, validateSession };
