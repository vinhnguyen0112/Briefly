const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const Chat = require("../models/chat");
const Message = require("../models/message");
const { v4: uuidv4 } = require("uuid");

/**
 * Creates a new chat for an authenticated user.
 * Requires sessionType "auth" and a valid user_id in the session.
 * Normalizes the page URL and generates a page_id hash.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const createChat = async (req, res, next) => {
  try {
    const { page_url, title } = req.body;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        success: true,
        message: "Nothing to insert",
        data: { affectedRows: 0 },
      });
    }

    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    const pageId = commonHelper.generateHash(normalizedPageUrl);
    const chatId = uuidv4();

    const chat = {
      id: chatId,
      user_id: req.session.user_id,
      page_id: pageId,
      page_url: normalizedPageUrl,
      title,
    };

    const affectedRows = await Chat.create(chat);

    res.json({
      success: true,
      message:
        affectedRows > 0 ? "Chat created" : "Chat already exists (ignored)",
      data: {
        chat,
        affectedRows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves a chat by its ID.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
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

/**
 * Retrieves paginated chats for the authenticated user.
 * Requires sessionType "auth" and a valid user_id in the session.
 * Supports offset and limit query parameters.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getPaginatedChats = async (req, res, next) => {
  try {
    let { offset = 0, limit = 20 } = req.query;
    offset = parseInt(offset, 10);
    limit = parseInt(limit, 10);
    if (isNaN(offset) || isNaN(limit) || limit <= 0 || offset < 0) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid offset or limit");
    }
    const filter = {
      offset: offset.toString(),
      limit: (limit + 1).toString(),
      user_id: req.session.user_id,
    };
    const chats = await Chat.getPaginated(filter);
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

/**
 * Updates a chat
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const updateChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        success: true,
        message: "Nothing to update",
        data: { affectedRows: 0 },
      });
    }

    const { title } = req.body;

    const affectedRows = await Chat.update(id, { title });
    res.json({
      success: true,
      message: "Chat updated successfully.",
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a chat by its ID.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const deleteChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    const affectedRows = await Chat.deleteById(id);
    res.json({
      success: true,
      message: "Chat deleted successfully.",
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes all chats of an user
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const deleteChatsOfUser = async (req, res, next) => {
  try {
    const affectedRows = await Chat.deleteByUserId(req.session.user_id);
    res.json({
      success: true,
      message: "Chats deleted successfully",
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Adds a message to a chat.
 * Requires chat_id, role, content, and model in the request.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const addMessage = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { role, content } = req.body;
    if (!chat_id || !role || !content) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing required fields: chat_id, role, or content"
      );
    }
    const id = await Message.create({ chat_id, ...req.body });
    res.json({
      success: true,
      message: "Message added successfully",
      data: {
        id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Adds a pair of messages (user + assistant) to a chat atomically.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const addMessagePair = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { messages } = req.body;

    if (!chat_id || !Array.isArray(messages) || messages.length !== 2) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing chat_id or invalid messages array (must be 2 items)"
      );
    }

    // Attach chat_id to each message
    const messagesToInsert = messages.map((msg) => ({
      chat_id,
      ...msg,
    }));

    const ids = await Message.createBulk(messagesToInsert);

    res.json({
      success: true,
      message: "Message pair added successfully",
      data: { ids },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all messages for a chat by chat_id.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getMessages = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    if (!chat_id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat_id");
    }
    const messages = await Message.getByChatId(chat_id);
    res.json({ success: true, data: { messages } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createChat,
  getChatById,
  getPaginatedChats,
  updateChat,
  deleteChatById,
  deleteChatsOfUser,
  addMessage,
  addMessagePair,
  getMessages,
};
