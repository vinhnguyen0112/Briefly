const { v4: uuidv4 } = require("uuid");
const Note = require("../models/note");
const { ERROR_CODES } = require("../errors");
const AppError = require("../models/appError");

/**
 * Create a new note
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const createNote = async (req, res, next) => {
  try {
    const { page_url, note } = req.body;
    const id = uuidv4();
    const createdAt = new Date();

    await Note.create({
      id,
      user_id: req.session.user_id,
      page_url,
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
 * Get notes for a page
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getNotesForPage = async (req, res, next) => {
  try {
    const { page_url } = req.query;

    if (!page_url) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Page URL is required");
    }

    const notes = await Note.getByUserAndPage(req.session.user_id, page_url);

    res.json({
      success: true,
      data: { notes },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all notes for user
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getAllNotes = async (req, res, next) => {
  try {
    const notes = await Note.getByUser(req.session.user_id);

    res.json({
      success: true,
      data: { notes },
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

/**
 * Get notes count
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const getNotesCount = async (req, res, next) => {
  try {
    const { page_url } = req.query;

    const totalCount = await Note.getCount(req.session.user_id);
    const pageCount = page_url
      ? await Note.getCount(req.session.user_id, page_url)
      : 0;

    res.json({
      success: true,
      data: {
        total: totalCount,
        page: pageCount,
      },
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
  getNotesCount,
};
