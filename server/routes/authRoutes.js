const express = require("express");
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

// Check if session is valid on serverside (for testing purpose)
router.post(
  "/session-validate",
  verifyOrigin,
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
router.post("/google/callback", verifyOrigin, authenticateWithGoogle);
router.post("/facebook/callback", verifyOrigin, authenticateWithFacebook);

// Sign out
router.post("/signout", verifyOrigin, signOut);
module.exports = router;
