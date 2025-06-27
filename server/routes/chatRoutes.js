const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const {
  validateSession,
  attachNewAnonSession,
} = require("../middlewares/authMiddlewares");
const chat = require("../models/chat");

router.use(validateSession, attachNewAnonSession);

// Chat routes
router
  .route("/")
  .get(chatController.getChatsBy)
  .post(chatController.createChat)
  .delete(chatController.deleteChat);

router
  .route("/:id")
  .get(chatController.getChatById)
  .put(chatController.updateChat)
  .delete(chatController.deleteChat);

// Nested message routes under /:chat_id/messages
router
  .route("/:chat_id/messages")
  .post(chatController.addMessage)
  .get(chatController.getMessages);

module.exports = router;
