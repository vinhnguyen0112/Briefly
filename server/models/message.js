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
   * Bulk insert messages into a chat
   * @param {Array<Object>} messages Array of message objects
   * @returns {Promise<Array<number>>} Array of inserted message IDs
   */
  async createBulk(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const columns = Object.keys(messages[0]);
    const placeholders = messages
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");
    const values = messages.flatMap((msg) => columns.map((col) => msg[col]));

    const query = `INSERT INTO messages (${columns.join(
      ", "
    )}) VALUES ${placeholders}`;
    const result = await dbHelper.executeQuery(query, values);

    const rowIds = [];
    for (
      let i = result.insertId;
      i < result.insertId + result.affectedRows;
      i++
    ) {
      rowIds.push(i);
    }
    return rowIds;
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
