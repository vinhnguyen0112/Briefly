const commonHelper = require("../helpers/commonHelper");
const Chat = require("../models/chat");
const Message = require("../models/message");

// Create a new chat
const createChat = async (req, res, next) => {
  try {
    let user_id = null;

    if (req.sessionType === "auth") {
      user_id = req.session.user_id;
    } else {
      throw new Error("Only authenticated user can save chat to database");
    }

    const { id, page_url, title } = req.body;

    // Normalize page url and hash it
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    const page_id = commonHelper.generateHash(normalizedPageUrl);
    await Chat.create({
      id,
      user_id,
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

// Get paginated chats
const getChatsBy = async (req, res, next) => {
  try {
    const { sessionType, session } = req;
    const { offset = 0, limit = 20 } = req.query;

    const filter = { offset, limit };
    if (sessionType === "auth") {
      filter.user_id = session.user_id;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid session type" });
    }

    const chats = await Chat.getBy(filter);
    let hasMore = false;
    if (chats.length > limit) {
      hasMore = true;
      chats.pop(); // Slice off last element to avoid duplication
    }
    return res.json({ success: true, data: { chats, hasMore } });
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

// Delete all user's chats
const deleteChatsBy = async (req, res, next) => {
  const { sessionType, session } = req;
  const filter = {};

  if (sessionType === "auth") {
    filter.user_id = session.user_id;
  } else {
    return res
      .status(400)
      .json({ success: false, message: "Invalid session type" });
  }

  await Chat.deleteBy(filter);
  return res.json({
    success: true,
    message: "User history deleted.",
  });
};

// Add a message to a chat
const addMessage = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { role, content, model } = req.body;
    // No need to generate id, it's auto-incremented in DB
    await Message.create({ chat_id, role, content, model });
    res.json({ success: true });
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
  getChatsBy,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  getMessageById,
  deleteMessage,
};
