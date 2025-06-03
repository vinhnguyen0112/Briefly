const dbHelper = require("../helpers/dbHelper");

class Message {
  async create(messageData) {
    // Only insert fields that are present in messageData
    const columns = Object.keys(messageData).join(", ");
    const placeholders = Object.keys(messageData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(messageData);

    const query = `INSERT INTO messages (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
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
