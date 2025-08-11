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
    let expired = false;
    const { page_url, title, page_content, pdf_content } = req.body;

    // Normalize and validate page_url
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    const id = commonHelper.generateHash(normalizedPageUrl);

    // Construct insertion body
    const insertBody = {
      id,
      page_url: normalizedPageUrl,
    };

    if (title) insertBody.title = title;
    if (page_content) insertBody.page_content = page_content;
    if (pdf_content) insertBody.pdf_content = pdf_content;

    let page = await Page.getById(id);

    // If not found or expired, create a new page
    if (!page || isPageExpired(page.updated_at)) {
      expired = !!page; // only true if it existed and is expired
      if (expired) await Page.deleteById(id); // Invalidate old page
      await redisHelper.deletePageSummaries(id); // Invalidate cached summaries
      page = await Page.create(insertBody);
    }

    res.json({
      success: true,
      message: "Page record is fresh and available",
      data: { id, expired },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a page by URL
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getPageByUrl = async (req, res, next) => {
  try {
    const { page_url } = req.query;
    if (!page_url) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing page_url");
    }

    // Normalize and hash
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    const id = commonHelper.generateHash(normalizedPageUrl);

    // Check database
    const page = await Page.getById(id);

    res.json({
      success: true,
      data: { page },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a page by ID
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getPageById = async (req, res, next) => {
  try {
    const { page_id } = req.params;
    if (!page_id) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing page_id");
    }

    const id = page_id.trim();

    // Check database
    const page = await Page.getById(id);

    res.json({
      success: true,
      data: { page },
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
const updatePageById = async (req, res, next) => {
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

    const { title, page_content, pdf_content } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (page_content) updates.page_content = page_content;
    if (pdf_content) updates.pdf_content = pdf_content;

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

/**
 * Update a page record using page URL
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const updatePageByUrl = async (req, res, next) => {
  try {
    const { page_url } = req.query;
    if (!page_url) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing page url");
    }

    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }
    const id = commonHelper.generateHash(normalizedPageUrl);

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        success: true,
        message: "Nothing to update",
        data: { affectedRows: 0 },
      });
    }

    // Build updates
    const { title, page_content, pdf_content } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (page_content) updates.page_content = page_content;
    if (pdf_content) updates.pdf_content = pdf_content;

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
  getPageByUrl,
  getPageById,
  updatePageById,
  updatePageByUrl,
};
