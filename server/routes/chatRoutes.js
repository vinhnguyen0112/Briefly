const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const {
  createChatSchema,
  updateChatSchema,
  createMessageSchema,
} = require("../schemas/yupSchemas");

router.use(requireAuthenticatedSession);

// Chat routes
router
  .route("/")
  .get(chatController.getPaginatedChats)
  .post(validateAndSanitizeBody(createChatSchema), chatController.createChat)
  .delete(chatController.deleteChatsOfUser);

router
  .route("/:id")
  .get(chatController.getChatById)
  .put(validateAndSanitizeBody(updateChatSchema), chatController.updateChat)
  .delete(chatController.deleteChatById);

// Message routes
router
  .route("/:chat_id/messages")
  .get(chatController.getMessages)
  .post(
    validateAndSanitizeBody(createMessageSchema),
    chatController.addMessage
  );

module.exports = router;
