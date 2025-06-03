const { generateHash } = require("../helpers/commonHelper");
const Chat = require("../models/chat");
const Message = require("../models/message");
const { v4: uuidv4 } = require("uuid");

// Create a new chat
const createChat = async (req, res, next) => {
  try {
    let user_id = null;
    let anon_session_id = null;

    if (req.sessionType === "auth") {
      user_id = req.session.user_id;
    } else if (req.sessionType === "anon") {
      anon_session_id = req.session.id;
    }

    const { id, page_url, title } = req.body;

    // TODO: Pre-process page_url, e.g., remove query params, normalize.
    // Consider making a middleware or helper func
    const page_id = generateHash(page_url);

    await Chat.create({
      id,
      user_id,
      anon_session_id,
      page_id,
      title,
    });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
};

// Get a chat by ID
const getChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const chat = await Chat.getById(id);
    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }
    res.json({ success: true, data: chat });
  } catch (err) {
    next(err);
  }
};

// TODO: Get user_id from req.session instead of req.body
// Get all chats for a user
const getChatsByUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const chats = await Chat.getByUserId(user_id);
    res.json({ success: true, data: chats });
  } catch (err) {
    next(err);
  }
};

// Get all chats for an anonymous session
const getChatsByAnonSession = async (req, res, next) => {
  try {
    const { anon_session_id } = req.params;
    const chats = await Chat.getByAnonSessionId(anon_session_id);
    res.json({ success: true, data: chats });
  } catch (err) {
    next(err);
  }
};

// Update a chat
const updateChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Chat.update(id, req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Delete a chat
const deleteChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Chat.delete(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Add a message to a chat
const addMessage = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { role, content, model } = req.body;
    const id = uuidv4();
    await Message.create({ id, chat_id, role, content, model });
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
};

// Get all messages for a chat
const getMessages = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
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
    const message = await Message.getById(message_id);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
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
    await Message.delete(message_id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createChat,
  getChatById,
  getChatsByUser,
  getChatsByAnonSession,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  getMessageById,
  deleteMessage,
};
