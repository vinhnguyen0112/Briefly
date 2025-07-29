const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

router.post(
  "/bulk-insert-chats",
  requireAuthenticatedSession,
  testController.bulkInsertChats
);

module.exports = router;
