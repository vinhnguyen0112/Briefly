const express = require("express");
const router = express.Router();
const notesController = require("../controllers/noteController");
const {
  requireAuthenticatedSession,
} = require("../middlewares/authMiddlewares");
const { validateAndSanitizeBody } = require("../middlewares/commonMiddlewares");
const { createNoteSchema, updateNoteSchema } = require("../schemas/yupSchemas");

router.use(requireAuthenticatedSession);

// Notes routes
router
  .route("/")
  .get(notesController.getNotesForPage)
  .post(validateAndSanitizeBody(createNoteSchema), notesController.createNote);

router.get("/all", notesController.getAllNotes);
router.get("/count", notesController.getNotesCount);

router
  .route("/:id")
  .put(validateAndSanitizeBody(updateNoteSchema), notesController.updateNote)
  .delete(notesController.deleteNote);

module.exports = router;
