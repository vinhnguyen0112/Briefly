const imageCaptionService = require("../services/imageCaptionService");

/**
 * Express handler for generating AI-powered image captions.
 * Accepts array of image sources and content context to generate relevant captions.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
const captionize = async (req, res, next) => {
  try {
    const { sources, context } = req.body;
    const { captions, usage } = await imageCaptionService.generateCaptions(
      sources,
      context
    );

    res.json({ success: true, data: { captions, usage } });
  } catch (err) {
    return next(err);
  }
};

module.exports = { captionize };
