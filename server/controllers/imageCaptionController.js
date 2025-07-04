const imageCaptionService = require("../services/imageCaptionService");

/**
 * Express handler for generating AI-powered image captions.
 * Accepts array of image sources and content context to generate relevant captions.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
const imageCaption = async (req, res, next) => {
  try {
    const { sources, content } = req.body;

    if (!Array.isArray(sources) || sources.length === 0) {
      return res
        .status(400)
        .json({ error: "sources must be a non-empty array" });
    }

    if (typeof content !== "string" || content.trim() === "") {
      return res
        .status(400)
        .json({ error: "Missing or invalid content context" });
    }

    const { captions, usage } = await imageCaptionService.generateCaptions(
      sources,
      content
    );
    console.log(captions);
    console.log(usage);
    res.json({ captions, usage });
  } catch (err) {
    return next(err);
  }
};

module.exports = { imageCaption };
