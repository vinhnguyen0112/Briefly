const express = require("express");
const { handleAnonSession } = require("../controllers/anonController");
const router = express.Router();

router.post("/", handleAnonSession);

module.exports = router;
