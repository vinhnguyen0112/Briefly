const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");

class Message {
  /**
   * Insert a message into a chat
   * @param {Object} data Message object
   * @returns {Promise<number>} Chat's ID
   */
  async create(data) {
    data = cleanDeep(data);
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const query = `INSERT INTO messages (${columns}) VALUES (${placeholders})`;
    const result = await dbHelper.executeQuery(query, values);
    return result.insertId;
  }

  /**
   * Get a message by ID
   * @param {String} id ID of the message
   * @returns {Promise<Object>} Chat object
   */
  async getById(id) {
    const query = "SELECT * FROM messages WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Get all messages of a chat by ID
   * @param {String} chat_id ID of the chat
   * @returns {Promise<Array>} Array of messages
   */
  async getByChatId(chat_id) {
    const query = "SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC";
    const rows = dbHelper.executeQuery(query, [chat_id]);
    return rows;
  }

  /**
   * Delete a message by ID
   * @param {String} id ID of the message to delete
   * @returns {Promise<number>} Number of affected rows
   */
  async delete(id) {
    const query = "DELETE FROM messages WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }
}

module.exports = new Message();
