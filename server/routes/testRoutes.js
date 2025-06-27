const express = require("express");
const router = express.Router();
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

router.route("/auth-only").post(requireAuthenticatedSession);

module.exports = router;
