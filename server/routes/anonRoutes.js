const express = require("express");
const { handleAnonSession } = require("../controllers/anonController");
const { verifyOrigin } = require("../middlewares/authMiddlewares");
const router = express.Router();

router.post("/", verifyOrigin, handleAnonSession);

module.exports = router;
