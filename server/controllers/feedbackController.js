const { v4: uuidv4 } = require("uuid");
const Feedback = require("../models/feedback");
const { loadSql, getConnection } = require("../helpers/dbHelper");

/**
 * Submit feedback from an authenticated user for a message.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const submitFeedback = async (req, res, next) => {
  // sql
  const sqlSelectMessage = `
  SELECT m.role, m.chat_id
  FROM messages m
  WHERE m.id = ?;
  `;
  const sqlCheckOwnership = `
  SELECT c.id
  FROM users u
  JOIN chats c ON u.id = c.user_id
  WHERE u.id = ?
    AND c.id = ?;
  `;

  try {
    const id = uuidv4();
    const { message_id, content } = req.body;
    const userId = req.session.user_id;

    const conn = await getConnection();

    // Check message role
    const [rows1] = await conn.query(sqlSelectMessage, [message_id]);
    if (rows1.length === 0) {
      throw new Error("Message not found");
    }
    const { role, chat_id } = rows1[0];
    if (role !== "assistant") {
      throw new Error("Invalid message role");
    }

    // Check ownership
    const [rows2] = await conn.query(sqlCheckOwnership, [userId, chat_id]);
    if (rows2.length === 0) {
      throw new Error("You don't own this message");
    }

    await Feedback.create({
      id,
      user_id: req.session.user_id,
      ...req.body,
    });

    res.json({
      success: true,
      data: {
        id,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { submitFeedback };
