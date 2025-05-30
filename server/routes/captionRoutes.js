const express = require("express");
const router = express.Router();
const { imageCaption } = require("../controllers/imageCaptionController");

// Commented this out for unecessary image captioning
// router.post("/", imageCaption);

module.exports = router;
