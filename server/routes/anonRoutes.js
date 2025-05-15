const express = require("express");
const { handleAnonSession } = require("../controllers/anonController");
const router = express.Router();

router.post(
  "/",
  (req, res, next) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(ip);
    next();
  },
  handleAnonSession
);

module.exports = router;
