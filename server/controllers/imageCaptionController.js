const imageCaptionService = require("../services/imageCaptionService");

exports.imageCaption = async (req, res, next) => {
  try {
    const { sources } = req.body; // client gửi mảng URLs dưới key `sources`
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
    next(err);
  }
};
