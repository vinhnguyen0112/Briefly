// Testing purpose only, ignore this.
const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const Chat = require("../models/chat");
const message = require("../models/message");

/**
 * Format date to MySQL timestamp (YYYY-MM-DD HH:MM:SS).
 */
function formatMySQLTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Bulk insert test chats for pagination testing.
 */
async function bulkInsertChats(req, res, next) {
  try {
    const { user_id } = req.session;
    if (!user_id)
      throw new AppError(ERROR_CODES.INVALID_INPUT, "User ID is missing");
    const { count = 30 } = req.body;

    const chats = [];
    for (let i = 0; i < count; i++) {
      const pageUrl = `https://example.com/page${i + 1}`;
      const now = new Date(Date.now() - i * 1000 * 60);
      const formatted = formatMySQLTimestamp(now);
      chats.push({
        id: crypto.randomUUID(),
        user_id,
        title: `Test Chat #${i + 1}`,
        page_url: pageUrl,
        page_id: commonHelper.generateHash(pageUrl),
        created_at: formatted,
        updated_at: formatted,
      });
    }

    await Chat.bulkInsert(chats);

    res.json({ success: true, message: "Bulk insert chats sucessfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkInsertChats };
