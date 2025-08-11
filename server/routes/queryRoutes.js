const express = require("express");
const router = express.Router();
const queryController = require("../controllers/queryController");
const { validateSession } = require("../middlewares/authMiddlewares");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const {
  createImageCaptionSchema,
  querySchema,
  suggestedQuestionSchema,
} = require("../schemas/yupSchemas");

router.use(validateSession);

router.post(
  "/captionize",
  validateAndSanitizeBody(createImageCaptionSchema),
  queryController.captionize
);

router.post(
  "/ask",
  validateAndSanitizeBody(querySchema),
  queryController.handleUserQuery
);
router.post(
  "/suggested-questions",
  validateAndSanitizeBody(suggestedQuestionSchema),
  queryController.generateSuggestedQuestions
);

module.exports = router;
