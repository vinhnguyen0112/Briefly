const dbHelper = require("../helpers/dbHelper");

class Message {
  /**
   * Insert a message into a chat
   * @param {Object} messageData Message data object
   * @param {String} messageData.chat_id
   * @param {String} messageData.role
   * @param {String} messageData.content
   * @param {String} [messageData.model]
   * @returns {Promise<number>} Created chat's ID
   */
  async create(messageData) {
    if (!messageData || Object.keys(messageData).length <= 0) return;

    const columns = Object.keys(messageData).join(", ");
    const placeholders = Object.keys(messageData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(messageData);

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
  async deleteById(id) {
    const query = "DELETE FROM messages WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }
}

module.exports = new Message();
