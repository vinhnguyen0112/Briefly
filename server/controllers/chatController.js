const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const Chat = require("../models/chat");
const Message = require("../models/message");

// Create a new chat
const createChat = async (req, res, next) => {
  try {
    if (req.sessionType !== "auth" || !req.session?.user_id) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Only authenticated user can save chat to database",
        401
      );
    }
    const { id, page_url, title } = req.body;
    if (!id || !page_url || !title) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing required fields: id, page_url, or title"
      );
    }
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }
    const page_id = commonHelper.generateHash(normalizedPageUrl);
    await Chat.create({
      id,
      user_id: req.session.user_id,
      page_url: normalizedPageUrl,
      page_id,
      title,
    });
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
};

// Get a chat by ID
// TODO: Will I ever call this endpoint
const getChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    const chat = await Chat.getById(id);
    if (!chat) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Chat not found", 404);
    }
    res.json({ success: true, data: chat });
  } catch (err) {
    next(err);
  }
};

// Get paginated chats
const getChatsBy = async (req, res, next) => {
  try {
    if (req.sessionType !== "auth" || !req.session?.user_id) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid session type", 401);
    }
    let { offset = 0, limit = 20 } = req.query;
    offset = parseInt(offset, 10);
    limit = parseInt(limit, 10);
    if (isNaN(offset) || isNaN(limit) || limit <= 0 || offset <= 0) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid offset or limit");
    }
    const filter = { offset, limit: limit + 1, user_id: req.session.user_id };
    const chats = await Chat.getBy(filter);
    let hasMore = false;
    if (chats.length > limit) {
      hasMore = true;
      chats.pop();
    }
    res.json({ success: true, data: { chats, hasMore } });
  } catch (err) {
    next(err);
  }
};

// Update a chat
const updateChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      res.json({ success: true, message: "Chat updated successfully." });
    }
    // TODO: No updated was return from Chat.update()
    const updated = await Chat.update(id, req.body);
    if (!updated) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Chat not found", 404);
    }
    res.json({ success: true, message: "Chat updated successfully." });
  } catch (err) {
    next(err);
  }
};

// Delete a chat
const deleteChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    // TODO: No deleted were return from Chat.delete()
    const deleted = await Chat.delete(id);
    if (!deleted) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Chat not found", 404);
    }
    res.json({ success: true, message: "Chat deleted successfully." });
  } catch (err) {
    next(err);
  }
};

// Delete all user's chats
const deleteChatsBy = async (req, res, next) => {
  try {
    if (req.sessionType !== "auth" || !req.session?.user_id) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid session type", 401);
    }
    await Chat.deleteBy({ user_id: req.session.user_id });
    res.json({ success: true, message: "Chats deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Add a message to a chat
// TODO: Update function to return created message's Id
const addMessage = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { role, content, model } = req.body;
    if (!chat_id || !role || !content) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing required fields: chat_id, role, or content"
      );
    }
    await Message.create({ chat_id, role, content, model });
    res.json({
      success: true,
      message: "Chat added successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get all messages for a chat
const getMessages = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    if (!chat_id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat_id");
    }
    const messages = await Message.getByChatId(chat_id);
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

// Get a single message by ID
const getMessageById = async (req, res, next) => {
  try {
    const { message_id } = req.params;
    if (!message_id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing message_id");
    }
    const message = await Message.getById(message_id);
    if (!message) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Message not found", 404);
    }
    res.json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

// Delete a message
const deleteMessage = async (req, res, next) => {
  try {
    const { message_id } = req.params;
    if (!message_id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing message_id");
    }
    const deleted = await Message.delete(message_id);
    if (!deleted) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Message not found", 404);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createChat,
  getChatById,
  getChatsBy,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  getMessageById,
  deleteMessage,
  deleteChatsBy,
};
