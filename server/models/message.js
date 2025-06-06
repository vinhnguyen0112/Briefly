const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");

class Message {
  async create(data) {
    data = cleanDeep(data);
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const query = `INSERT INTO messages (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  async getById(id) {
    const query = "SELECT * FROM messages WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  async getByChatId(chat_id) {
    const query = "SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC";
    return dbHelper.executeQuery(query, [chat_id]);
  }

  async delete(id) {
    const query = "DELETE FROM messages WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Message();
