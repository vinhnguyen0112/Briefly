const express = require('express');
const router = express.Router();
const { imageCaption } = require('../controllers/imageCaptionController');

// POST /api/image-caption
router.post('/', imageCaption);

module.exports = router;
