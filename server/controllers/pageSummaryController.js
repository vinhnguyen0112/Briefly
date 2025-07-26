const commonHelper = require("../helpers/commonHelper");
const PageSummary = require("../models/pageSummary");

exports.createSummary = async (req, res, next) => {
  try {
    const { page_url, language, summary } = req.body;

    const normalizedPageUrl = commonHelper.processUrl(page_url);
    const page_id = commonHelper.generateHash(normalizedPageUrl);

    await PageSummary.insert({
      page_id,
      language,
      summary,
    });

    res
      .status(200)
      .json({ success: true, message: "Page summary saved successfully" });
  } catch (err) {
    next(err);
  }
};
