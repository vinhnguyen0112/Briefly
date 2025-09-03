const express = require("express");

const router = express.Router();

// Check if session is valid on serverside
router.get("/", (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.6-dev',
  });
});

module.exports = router;
