const express = require("express");
const {
  validateSession,
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");
const {
  authenticateWithGoogle,
  authenticateWithFacebook,
  signOut,
} = require("../controllers/authControllers");

const router = express.Router();

// Check if session is valid on serverside
router.post("/session-validate", validateSession, (req, res) => {
  res.json({
    success: true,
    message: "Session is valid",
  });
});

// Check if session is authenticated only
router.post("/auth-only", requireAuthenticatedSession, (req, res) => {
  res.json({
    success: true,
    message: "Session is valid",
  });
});

// Authentication redirects
router.post("/google/callback", authenticateWithGoogle);
router.post("/facebook/callback", authenticateWithFacebook);

// Sign out
router.post("/signout", validateSession, signOut);
module.exports = router;
