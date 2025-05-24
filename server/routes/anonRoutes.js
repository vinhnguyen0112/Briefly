const express = require("express");
const { handleAnonSession } = require("../controllers/anonController");
const router = express.Router();

router.post(
  "/",
  // (req, res, next) => {
  //   const ip = req.ip;
  //   if (ip && ip.includes(",")) {
  //     ip = ip.split(",")[0].trim();
  //   }
  //   console.log("Client IP: ", ip);
  //   next();
  // },
  handleAnonSession
);

module.exports = router;
