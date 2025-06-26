const express = require("express");
const router = express.Router();
const { submitFeedback } = require("../controllers/feedbackController");
const { validateSession } = require("../middlewares/authMiddlewares");

router.post("/", validateSession, submitFeedback);

module.exports = router;
