const commonHelper = require("../helpers/commonHelper");
const { redisHelper } = require("../helpers/redisHelper");
const PageSummary = require("../models/pageSummary");

exports.createSummary = async (req, res, next) => {
  try {
    const { page_url, language, summary } = req.body;

    const normalizedPageUrl = commonHelper.processUrl(page_url);
    const pageId = commonHelper.generateHash(normalizedPageUrl);

    const { insertId, affectedRows } = await PageSummary.insert({
      page_id: pageId,
      language,
      summary,
    });

    await redisHelper.setPageSummary({
      pageId,
      language,
      summary,
    });

    res.status(200).json({
      success: true,
      message:
        affectedRows === 0
          ? "Page summary ignored"
          : "Page summary saved successfully",
      data: { id: insertId, affectedRows },
    });
  } catch (err) {
    next(err);
  }
};
