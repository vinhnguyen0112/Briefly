const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const session = require("express-session");
const { RedisService } = require("../services/redisService");

const router = express.Router();
const client = new OAuth2Client();

router.post("/google/callback", async (req, res) => {
  try {
    const { idToken } = req.body;
    await verifyIdToken(idToken);

    const sessionId = crypto.randomUUID();
    console.log("Session id: ", sessionId);
    // Send back sessionID to extension

    await RedisService.set(
      sessionId,
      {
        authenticated: true,
      },
      60 * 60 * 24 // 1 day expiration
    ); // 1 day expiration

    return res.status(200).json({
      success: true,
      data: sessionId,
    });
  } catch (error) {
    console.error("Error during Google authentication:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

const verifyIdToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
    });
    const payload = ticket.getPayload();

    console.log("Payload: ", payload);

    const userId = payload["sub"];
    return userId;
  } catch (error) {
    throw error;
  }
};

// const generateTokens = (userId) => {
//   const accessToken = jwt.sign({ userId }, "your_access_token_secret", {
//     expiresIn: "15m",
//   });
//   const refreshToken = jwt.sign({ userId }, "your_refresh_token_secret", {
//     expiresIn: "7d",
//   });

//   return { accessToken, refreshToken };
// };

module.exports = router;
