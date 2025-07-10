const { OpenAI } = require("openai");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate response for user query using OpenAI model
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const handleUserQuery = async (req, res, next) => {
  try {
    const { messages, max_tokens } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens,
      messages,
    });

    if (
      !completion ||
      !completion.choices ||
      !completion.choices[0] ||
      !completion.choices[0].message
    ) {
      throw new AppError(
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        "Invalid OpenAI response"
      );
    }

    res.json({
      success: true,
      data: {
        message: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  handleUserQuery,
};
