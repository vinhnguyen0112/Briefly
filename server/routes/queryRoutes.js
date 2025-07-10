const express = require("express");
const router = express.Router();
const queryController = require("../controllers/queryController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

router.use(requireAuthenticatedSession);

router.post("/", queryController.handleUserQuery);

module.exports = router;
