const imageCaptionService = require("../services/imageCaptionService");

const imageCaption = async (req, res, next) => {
  try {
    // Array of img sources
    const { sources } = req.body;
    if (!Array.isArray(sources) || sources.length === 0) {
      return res
        .status(400)
        .json({ error: "sources must be a non-empty array" });
    }

    const { captions, usage } = await imageCaptionService.generateCaptions(
      sources
    );
    console.log(captions);
    console.log(usage);
    res.json({ captions, usage });
  } catch (err) {
    return next(err);
  }
};

module.exports = { imageCaption };
