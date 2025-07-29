const { v4: uuidv4 } = require("uuid");
const Feedback = require("../models/feedback");

/**
 * Submit feedback from an authenticated user for a message.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const submitFeedback = async (req, res, next) => {
  try {
    const id = uuidv4();
    const createdAt = new Date();

    // TODO: Check if message's role is assistant

    await Feedback.create({
      id,
      user_id: req.session.user_id,
      created_at: createdAt,
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
