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
    const { count = 30 } = req.body;

    const chats = [];
    for (let i = 0; i < count; i++) {
      const pageUrl = `https://example.com/page${i + 1}`;
      chats.push({
        id: crypto.randomUUID(),
        user_id,
        page_id: commonHelper.generateHash(pageUrl),
        page_url: pageUrl,
        title: `Test Chat #${i + 1}`,
      });
    }

    await Chat.bulkInsert(chats);

    res.json({ success: true, message: "Bulk insert chats sucessfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkInsertChats };
