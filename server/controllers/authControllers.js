import { verifyIdToken } from "../services/authService.js";
import { redisClient } from "../services/redisService.js";

export const authenticateWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    // Verify ID token
    const userId = await verifyIdToken(idToken);

    // Create session on server-side
    const sessionId = crypto.randomUUID();
    await redisClient.set(sessionId, userId, { EX: 60 * 60 * 24 * 7 }); // Expires in 7 days
    return res.status(200).json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Error during Google authentication:", error.message);
    return next(error);
  }
};
