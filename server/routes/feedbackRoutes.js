const express = require("express");
const router = express.Router();
const { submitFeedback } = require("../controllers/feedbackController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const { createFeedbackSchema } = require("../schemas/yupSchemas");

router.post(
  "/",
  requireAuthenticatedSession,
  validateAndSanitizeBody(createFeedbackSchema),
  submitFeedback
);

module.exports = router;
