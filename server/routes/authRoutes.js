const express = require("express");
const { validateSession } = require("../middlewares/authMiddlewares");
const {
  authenticateWithGoogle,
  authenticateWithFacebook,
  signOut,
} = require("../controllers/authControllers");

const router = express.Router();

// Check if session is valid on serverside (for testing purpose)
router.post(
  "/session-validate",
  validateSession,
  // If request passed validateSession, session is guaranteed to be valid
  (req, res) => {
    res.json({
      success: true,
      message: "Session is valid",
    });
  }
);

// Authentication redirects
router.post("/google/callback", authenticateWithGoogle);
router.post("/facebook/callback", authenticateWithFacebook);

// Sign out
router.post("/signout", validateSession, signOut);
module.exports = router;
