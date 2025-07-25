const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const Page = require("../models/page");
const { redisHelper } = require("../helpers/redisHelper");

/**
 * Pre-process then insert a page into the database
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const createPage = async (req, res, next) => {
  try {
    const body = {};
    const { page_url, title, page_content } = req.body;

    // Filtering
    if (page_url) body.page_url = page_url;
    if (title) body.title = title;
    if (page_content) body.page_content = page_content;

    // Normalize page url
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    // Hash the page url
    const id = commonHelper.generateHash(normalizedPageUrl);

    // Try to get from Redis
    const cached = await redisHelper.getPage(id);
    if (!cached) {
      // Try to get from database
      const stored = await Page.getById(id);
      // Store if not found
      if (!stored) {
        await Page.create({
          id,
          ...body,
        });
      }

      // Always update cache
      // TODO: Incorrect
      redisHelper.setPage(id, {
        page_url: stored.page_url,
        title: stored.title,
        page_content: stored.page_content,
      });
    }

    res.json({
      success: true,
      message: "Page data inserted successfully",
      data: { id, cached: !!cached },
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
