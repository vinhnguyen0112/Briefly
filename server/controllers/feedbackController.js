const { v4: uuidv4 } = require("uuid");
const Feedback = require("../models/feedback");
const { loadSql, getConnection } = require("../helpers/dbHelper");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

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

  const conn = await getConnection();

  try {
    const id = uuidv4();
    const { message_id, stars, comment } = req.body;
    const userId = req.session.user_id;
    // Check message role
    const [rows1] = await conn.query(sqlSelectMessage, [message_id]);
    if (rows1.length === 0) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Message not found", 400);
    }
    const { role, chat_id } = rows1[0];
    if (role !== "assistant") {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Invalid message role",
        400
      );
    }

    // Check ownership
    const [rows2] = await conn.query(sqlCheckOwnership, [userId, chat_id]);
    if (rows2.length === 0) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "You don't own this message",
        400
      );
    }

    const feedbackBody = { id, user_id: userId };
    if (message_id) feedbackBody.message_id = message_id;
    if (stars) feedbackBody.stars = stars;
    if (comment !== undefined) feedbackBody.comment = comment;

    await Feedback.create(feedbackBody);

    return res.json({
      success: true,
      data: {
        id,
      },
    });
  } catch (err) {
    return next(err);
  } finally {
    conn.end();
  }
};

module.exports = { submitFeedback };
