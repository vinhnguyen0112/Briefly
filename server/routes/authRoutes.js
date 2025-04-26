const express = require("express");
const { redisClient } = require("../services/redisService");
const {
  verifyOrigin,
  validateSession,
} = require("../middlewares/authMiddlewares");
const {
  authenticateWithGoogle,
  authenticateWithFacebook,
  signOut,
} = require("../controllers/authControllers");

const router = express.Router();

// Route for authentication & security testing
router.post("/test", verifyOrigin, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Test done",
  });
});

// Check if session is valid (call upon extension load)
router.post("/session-validate", verifyOrigin, validateSession);

// Authentication redirects
router.post("/google/callback", verifyOrigin, authenticateWithGoogle);
router.post("/facebook/callback", verifyOrigin, authenticateWithFacebook);

// Sign out
router.post("/logout", verifyOrigin, signOut);
module.exports = router;
