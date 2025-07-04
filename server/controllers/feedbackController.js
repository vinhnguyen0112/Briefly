const { v4: uuidv4 } = require("uuid");
const Feedback = require("../models/feedback");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Submit feedback from an authenticated user.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { stars, comment, messageId } = req.body;
    const id = uuidv4();
    const createdAt = new Date();

    console.log("Inserting into database");

    await Feedback.create({
      id,
      message_id: messageId,
      user_id: req.session.user_id,
      stars,
      comment: comment || "",
      created_at: createdAt,
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
