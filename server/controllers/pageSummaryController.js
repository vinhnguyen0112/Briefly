const commonHelper = require("../helpers/commonHelper");
const PageSummary = require("../models/pageSummary");

exports.createOrUpdateSummary = async (req, res, next) => {
  try {
    const { page_url, language, summary } = req.body;

    const page_id = commonHelper.generateHash(page_url);

    await PageSummary.upsert({
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
