const express = require("express");

const router = express.Router();

// Check if session is valid on serverside
router.get("/", (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.5',
  });
});

module.exports = router;
