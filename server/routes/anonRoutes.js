const express = require("express");
const router = express.Router();
const { handleAnonSession } = require("../controllers/anonController");

router.post("/", handleAnonSession);

module.exports = router;
