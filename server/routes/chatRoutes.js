const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const {
  verifyOrigin,
  validateSession,
} = require("../middlewares/authMiddlewares");

router.use(verifyOrigin, validateSession);

// Chat routes
router.route("/").post(chatController.createChat);

router
  .route("/:id")
  .get(chatController.getChatById)
  .put(chatController.updateChat)
  .delete(chatController.deleteChat);

// TODO: Rework get functions to use session data instead of params. Centralize get function under same route
router.get("/user/:user_id", chatController.getChatsByUser);
router.get("/anon/:anon_session_id", chatController.getChatsByAnonSession);

// Nested message routes under /:chat_id/messages
router
  .route("/:chat_id/messages")
  .post(chatController.addMessage) // Add message to chat
  .get(chatController.getMessages); // Get all messages for chat

router
  .route("/:chat_id/messages/:message_id")
  .get(chatController.getMessageById) // Get single message
  .delete(chatController.deleteMessage); // Delete message

module.exports = router;
