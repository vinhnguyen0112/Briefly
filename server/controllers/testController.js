// Testing purpose only, ignore this.
const commonHelper = require("../helpers/commonHelper");
const Chat = require("../models/chat");

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
