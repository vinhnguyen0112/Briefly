const { extractTokenFromHeader } = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
// Verify the origin of the request to ensure it's from our Chrome extension
const verifyOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  // If the request has on origin and from our extension, allow it to proceed
  if (origin && origin === `chrome-extension://${process.env.EXTENSION_ID}`) {
    console.log("The request origin is valid.");
    return next();
  }

  return next(new Error("Unauthorized request from invalid origin."));
};

// Validate the session
const validateSession = async (req, res, next) => {
  try {
    const sessionId = extractTokenFromHeader(req);
    const cachedSession = await redisHelper.getSession(sessionId);

    if (cachedSession) {
      // Pass session onward
      req.session = cachedSession;
      return next();
    } else {
      // Check if session exists in database
      const persistedSession = await Session.getById(sessionId);
      if (persistedSession) {
        // Update cache
        console.log("Persisted session found: ", persistedSession);
        console.log("Updating Redis cache");
        await redisHelper.createSession(
          persistedSession.id,
          persistedSession.user_id
        );
        return next();
      } else {
        return res.status(401).json({
          success: false,
          message: "Session doesn't exists or has expired.",
        });
      }
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = { verifyOrigin, validateSession };
