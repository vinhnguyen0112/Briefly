const express = require("express");
const router = express.Router();
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

// Protected
router.use(requireAuthenticatedSession);

module.exports = router;
