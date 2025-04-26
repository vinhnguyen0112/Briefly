import { verifyIdToken } from "../services/authService.js";
import { redisClient } from "../services/redisService.js";

const FACEBOOK_TOKEN_DEBUG_URL = "https://graph.facebook.com/debug_token";

export const authenticateWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    // Verify ID token
    const userId = await verifyIdToken(idToken);

    // Create session on server-side
    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId,
    };
    await redisClient.set(`sess:${sessionId}`, JSON.stringify(sessionData), {
      EX: 60 * 60 * 24 * 7, // Expires in 7 days
    });
    return res.status(200).json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Error during Google authentication:", error.message);
    return next(error);
  }
};

export const authenticateWithFacebook = async (req, res, next) => {
  try {
    const { accessToken } = req.body;

    // Verify access token
    const url = new URL(FACEBOOK_TOKEN_DEBUG_URL);
    url.searchParams.append("input_token", accessToken);
    url.searchParams.append(
      "access_token",
      `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );

    const response = await fetch(url.href);
    if (!response.ok) {
      throw new Error("Failed to verify access token");
    }

    const data = await response.json();
    if (!data && data.data.error) {
      throw new Error("Invalid access token");
    }

    console.log(data.data);

    // Create session on server-side
    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId: data.data.user_id,
    };
    await redisClient.set(`sess:${sessionId}`, JSON.stringify(sessionData), {
      EX: 60 * 60 * 24 * 7, // Expires in 7 days
    });
    return res.status(200).json({
      success: true,
      sessionId,
    });
  } catch (err) {
    return next(err);
  }
};

export const signOut = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    await redisClient.del(`sess:${sessionId}`);

    return res.status(200).json({
      success: true,
      message: "Session deleted",
    });
  } catch (err) {
    return next(err);
  }
};
