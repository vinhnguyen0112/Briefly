const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const { createPageSchema, updatePageSchema } = require("../schemas/yupSchemas");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

// Protected
router.use(requireAuthenticatedSession);

router.route("/:page_id").get(pageController.getPageById);

router
  .route("/")
  .post(validateAndSanitizeBody(createPageSchema), pageController.createPage);

module.exports = router;
