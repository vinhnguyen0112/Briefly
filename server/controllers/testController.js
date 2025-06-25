const commonHelper = require("../helpers/commonHelper");
const Chat = require("../models/chat");

/**
 * Format date to MySQL timestamp (YYYY-MM-DD HH:MM:SS).
 */
function formatMySQLTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Bulk insert test chats for pagination testing.
 */
async function bulkInsertChats(req, res) {
  try {
    const { user_id, count = 30 } = req.body;
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_ID",
          message: "user_id required",
        },
      });
    }

    const chats = [];
    for (let i = 0; i < count; i++) {
      const pageUrl = `https://example.com/page${i + 1}`;
      const now = new Date(Date.now() - i * 1000 * 60);
      const formatted = formatMySQLTimestamp(now);
      chats.push({
        id: crypto.randomUUID(),
        user_id: user_id || null,
        title: `Test Chat #${i + 1}`,
        page_url: pageUrl,
        page_id: commonHelper.generateHash(pageUrl),
        created_at: formatted,
        updated_at: formatted,
      });
    }

    await Chat.bulkInsert(chats);

    res.json({ success: true, inserted: chats.length });
  } catch (err) {
    console.error("Bulk insert error:", err);
    res.status(500).json({
      success: false,
      error: { code: "BULK_INSERT_ERROR", message: err.message },
    });
  }
}

module.exports = { bulkInsertChats };
