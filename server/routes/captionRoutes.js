const express = require("express");
const router = express.Router();
const {
  imageCaption,
  captionize,
} = require("../controllers/imageCaptionController");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const { createImageCaptionSchema } = require("../schemas/yupSchemas");

// Commented this out for unnecessary image captioning
router.post("/", validateAndSanitizeBody(createImageCaptionSchema), captionize);

module.exports = router;
