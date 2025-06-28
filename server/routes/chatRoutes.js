const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");

router.use(requireAuthenticatedSession);

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

// Message routes
router
  .route("/:chat_id/messages")
  .post(chatController.addMessage)
  .get(chatController.getMessages);

module.exports = router;
