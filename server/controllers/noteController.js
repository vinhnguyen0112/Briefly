const { v4: uuidv4 } = require("uuid");
const Note = require("../models/note");
const { ERROR_CODES } = require("../errors");
const AppError = require("../models/appError");
const commonHelper = require("../helpers/commonHelper");

/**
 * Create a new note
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const createNote = async (req, res, next) => {
  try {
    const { page_url, note } = req.body;

    // Normalize URL before saving
    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    const id = uuidv4();
    const createdAt = new Date();

    await Note.create({
      id,
      user_id: req.session.user_id,
      page_url: normalizedPageUrl,
      note,
      created_at: createdAt,
      updated_at: createdAt,
    });

    res.json({
      success: true,
      data: { id },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get notes for a page with pagination
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getNotesForPage = async (req, res, next) => {
  try {
    const { page_url, offset = 0, limit = 20 } = req.query;

    if (!page_url) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Page URL is required");
    }

    const normalizedPageUrl = commonHelper.processUrl(page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    // Parse pagination parameters
    const offsetNum = parseInt(offset, 10) || 0;
    const limitNum = parseInt(limit, 10) || 20;

    if (limitNum <= 0 || offsetNum < 0) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid offset or limit");
    }

    // Get notes with one extra to check if there are more
    const notes = await Note.getByUserAndPagePaginated(
      req.session.user_id,
      normalizedPageUrl,
      offsetNum.toString(),
      (limitNum + 1).toString()
    );

    // Check if there are more notes
    let hasMore = false;
    if (notes.length > limitNum) {
      hasMore = true;
      notes.pop(); // Remove the extra note
    }

    res.json({
      success: true,
      data: { notes, hasMore },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all notes for user with pagination
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getAllNotes = async (req, res, next) => {
  try {
    const { offset = 0, limit = 20 } = req.query;

    // Parse pagination parameters
    const offsetNum = parseInt(offset, 10) || 0;
    const limitNum = parseInt(limit, 10) || 20;

    if (limitNum <= 0 || offsetNum < 0) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid offset or limit");
    }

    // Get notes with one extra to check if there are more
    const notes = await Note.getByUserPaginated(
      req.session.user_id,
      offsetNum.toString(),
      (limitNum + 1).toString()
    );

    // Check if there are more notes
    let hasMore = false;
    if (notes.length > limitNum) {
      hasMore = true;
      notes.pop(); // Remove the extra note
    }

    res.json({
      success: true,
      data: { notes, hasMore },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a note
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    // Check if note exists and belongs to the user
    const existingNote = await Note.getById(id);
    if (!existingNote || existingNote.user_id !== req.session.user_id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Note not found", 404);
    }

    const updatedAt = new Date();
    const affectedRows = await Note.update(id, {
      note,
      updated_at: updatedAt,
    });

    res.json({
      success: true,
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a note
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if note exists and belongs to the user
    const existingNote = await Note.getById(id);
    if (!existingNote || existingNote.user_id !== req.session.user_id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Note not found", 404);
    }

    const affectedRows = await Note.delete(id);

    if (affectedRows === 0) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Note not found", 404);
    }

    res.json({
      success: true,
      data: { affectedRows },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createNote,
  getNotesForPage,
  getAllNotes,
  updateNote,
  deleteNote,
};
