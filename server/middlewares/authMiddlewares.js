import { redisClient } from "../services/redisService.js";

// Verify the origin of the request to ensure it's from our Chrome extension
export const verifyOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  console.log("Request origin: ", origin);

  // If the request has on origin and from our extension, allow it to proceed
  if (origin && origin === `chrome-extension://${process.env.EXTENSION_ID}`) {
    console.log("Valid origin: ", origin);
    return next();
  }

  return next(
    new Error(
      "Unauthorized request from non-browser context or invalid origin."
    )
  );
};

export const validateSession = async (req, res, next) => {
  try {
    console.log(req.body);
    const { sessionId } = req.body;

    // No sessionId provided
    if (!sessionId) {
      return res.status(200).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const sessionData = await redisClient.get(`sess:${sessionId}`);
    // Session ID unexists
    if (!sessionData) {
      return res.status(200).json({
        success: false,
        message: "Session not found",
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "Session found & is valid",
      });
    }
  } catch (err) {
    next(err);
  }
};
