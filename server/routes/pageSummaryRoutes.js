const express = require("express");
const router = express.Router();
const pageSummaryController = require("../controllers/pageSummaryController");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const { createPageSummarySchema } = require("../schemas/yupSchemas");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

// Protected route
router.use(requireAuthenticatedSession);

router.post(
  "/",
  validateAndSanitizeBody(createPageSummarySchema),
  pageSummaryController.createSummary
);

module.exports = router;
