const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/authService");
const session = require("express-session");
const { RedisService } = require("../services/redisService");

const router = express.Router();
const client = new OAuth2Client();

router.post("/google/callback", async (req, res) => {
  const { idToken } = req.body;
  console.log("Received id token: ", idToken);
  const userId = await verifyIdToken(idToken);

  // Create access & refresh tokens
  const accessToken = generateAccessToken({ userId });
  const refreshToken = generateRefreshToken({ userId });

  const sessionId = crypto.randomUUID();
  console.log("Access token: ", accessToken);
  console.log("Refresh token: ", refreshToken);
  console.log("Session id: ", sessionId);
  // Send back sessionID to extension

  await RedisService.set(sessionId, {
    accessToken,
    refreshToken,
  });

  return res.status(200).json({
    success: true,
    data: sessionId,
  });
});

const verifyIdToken = async (token) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
  });
  const payload = ticket.getPayload();

  console.log("Payload: ", payload);

  const userId = payload["sub"];
  return userId;
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
