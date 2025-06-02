const dbHelper = require("../helpers/dbHelper");

class Message {
  async create(messageData) {
    const { id, chat_id, query_text, response, model } = messageData;
    const query = `
      INSERT INTO messages (id, chat_id, query_text, response, model)
      VALUES (?, ?, ?, ?, ?)
    `;
    await dbHelper.executeQuery(query, [
      id,
      chat_id,
      query_text,
      response,
      model,
    ]);
  }

  async getById(id) {
    const query = "SELECT * FROM messages WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  async getByChatId(chat_id) {
    const query =
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC";
    return dbHelper.executeQuery(query, [chat_id]);
  }

  async delete(id) {
    const query = "DELETE FROM messages WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Message();
