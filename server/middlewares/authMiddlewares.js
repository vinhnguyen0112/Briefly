const { getSession } = require("../helpers/redisHelper");

// Verify the origin of the request to ensure it's from our Chrome extension
const verifyOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  console.log("Request origin: ", origin);

  // If the request has on origin and from our extension, allow it to proceed
  if (origin && origin === `chrome-extension://${process.env.EXTENSION_ID}`) {
    console.log("Valid origin: ", origin);
    return next();
  }

  return next(new Error("Unauthorized request from invalid origin."));
};

// Validate the session
const validateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const result = await getSession(sessionId);

    if (result.isValid) {
      // Pass session data onward
      req.sessionData = result.sessionData;
      return next();
    }
    // return right away if session invalid
    // consider changing to throwing error for easier handling on frontend
    else {
      return res.json({ success: false, message: result.message });
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = { verifyOrigin, validateSession };
