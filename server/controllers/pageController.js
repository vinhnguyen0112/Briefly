const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const Page = require("../models/page");
const { redisHelper } = require("../helpers/redisHelper");

const PAGE_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Check if a timestamp is expired based on max age
 * @param {string|Date} updatedAt
 * @returns {boolean}
 */
function isPageExpired(updatedAt) {
  const updatedTime = new Date(updatedAt).getTime();
  return Date.now() - updatedTime > PAGE_FRESHNESS_MS;
}

/**
 * Pre-process then insert a page into the database (with freshness check and Redis fallback)
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const createPage = async (req, res, next) => {
  try {
    const { page_url, title, page_content } = req.body;

    // Normalize and validate page_url
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    const id = commonHelper.generateHash(normalizedPageUrl);

    // Try Redis first
    const cached = await redisHelper.getPage(id);
    if (cached) {
      return res.json({
        success: true,
        message: "Page found in cache",
        data: { id, cached: true },
      });
    }

    // Construct insert body (omit undefined/null/empty)
    const insertBody = {
      id,
      page_url: normalizedPageUrl,
      ...(title ? { title } : {}),
      page_content,
    };

    let page = await Page.getById(id);

    // Insert or re-insert if expired
    if (!page || isPageExpired(page.updated_at)) {
      if (page) await Page.deleteById(id);
      page = await Page.create(insertBody);
    }

    if (!page) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to create or retrieve page"
      );
    }

    // Update Redis
    await redisHelper.setPage(id, {
      page_url: page.page_url,
      normalized_page_url: normalizedPageUrl,
      title: page.title,
      page_content: page.page_content,
    });

    res.json({
      success: true,
      message: "Page record is fresh and available",
      data: { id, cached: false },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a page record by ID
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const updatePage = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing page id");
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        success: true,
        message: "Nothing to update",
        data: { affectedRows: 0 },
      });
    }

    const { title, summary, suggested_questions } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (summary) updates.summary = summary;
    if (suggested_questions) updates.suggested_questions = suggested_questions;

    const affectedRows = await Page.update(id, updates);
    res.json({
      success: true,
      message: "Page updated successfully.",
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPage,
  updatePage,
};
