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

router
  .route("/")
  .get(pageController.getPageById)
  .post(validateAndSanitizeBody(createPageSchema), pageController.createPage);

// router.put(
//   "/:id",
//   validateAndSanitizeBody(updatePageSchema),
//   pageController.updatePage
// );

module.exports = router;
