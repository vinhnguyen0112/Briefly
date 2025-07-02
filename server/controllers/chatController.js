const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const Chat = require("../models/chat");
const Message = require("../models/message");

/**
 * Creates a new chat for an authenticated user.
 * Requires sessionType "auth" and a valid user_id in the session.
 * Normalizes the page URL and generates a page_id hash.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const createChat = async (req, res, next) => {
  try {
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
    const pageId = commonHelper.generateHash(normalizedPageUrl);
    await Chat.create({
      id,
      user_id: req.session.user_id,
      page_url: normalizedPageUrl,
      page_id: pageId,
      title,
    });
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves a chat by its ID.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
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
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const getChatsBy = async (req, res, next) => {
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

/**
 * Updates a chat by its ID.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
const updateChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing chat id");
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      res.json({ success: true, message: "Chat updated successfully." });
    }
    const affectedRows = await Chat.update(id, req.body);
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
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
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
 * Deletes all chats for the authenticated user.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
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
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 */
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
    const id = await Message.create({ chat_id, role, content, model });
    res.json({
      success: true,
      message: "Chat added successfully",
      data: {
        id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all messages for a chat by chat_id.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
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
  getChatsBy,
  updateChat,
  deleteChatById,
  deleteChatsOfUser,
  addMessage,
  getMessages,
};
