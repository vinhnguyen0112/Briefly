const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");
class Chat {
  /**
   * Insert a chat into database. Returns nothing
   * @param {Object} data Chat object to insert
   */
  async create(data) {
    data = cleanDeep(data);
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const query = `INSERT INTO chats (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  // Bulk insert chats
  // For testing purpose only, ignore this
  async bulkInsert(chats) {
    if (!Array.isArray(chats) || chats.length === 0) return;
    // Assume all chats have the same keys
    const columns = Object.keys(chats[0]);
    const placeholders = "(" + columns.map(() => "?").join(", ") + ")";
    const allPlaceholders = chats.map(() => placeholders).join(", ");
    const values = chats.flatMap((chat) => columns.map((col) => chat[col]));

    const query = `INSERT INTO chats (${columns.join(
      ", "
    )}) VALUES ${allPlaceholders}`;
    await dbHelper.executeQuery(query, values);
  }

  /**
   * Get a chat by ID, without the messages
   * @param {String} id ID of the chat
   * @returns {Promise<Object>} Chat object
   */
  async getById(id) {
    const query = "SELECT * FROM chats WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Retrieves an user's chats with pagination.
   * Results are ordered by created_at in descending order
   * @param {Object} conditions - Query conditions
   * @param {String} conditions.user_id - The user ID to filter chats
   * @param {number} conditions.offset - Pagination offset (default: 0)
   * @param {number} conditions.limit - Maximum number of results to return (default: 20)
   * @returns {Promise<Array>} - An array of chats
   */
  async getBy({ user_id, offset = 0, limit = 20 }) {
    let query = "SELECT * FROM chats";
    const conditions = [];
    const values = [];

    if (user_id) {
      conditions.push("user_id = ?");
      values.push(user_id);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const rows = await dbHelper.executeQuery(query, values);
    return rows;
  }

  /**
   * Update a chat
   * @param {String} id ID of the chat
   * @param {Object} updates Update values
   * @returns {Promise<number>} Number of affected rows
   */
  async update(id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    if (fields.length === 0) return;
    // Always update updated_at timestamp
    fields.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE chats SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }

  /**
   * Delete a chat
   * @param {String} id ID of the chat
   * @returns {Promise<number>} Number of affected rows
   */
  // TODO: Change func name
  async delete(id) {
    const query = "DELETE FROM chats WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }

  // TODO: Change func name or implementation
  async deleteBy({ user_id }) {
    let query = "DELETE FROM chats ";
    let value;

    if (user_id) {
      query += `WHERE user_id = ?`;
      value = user_id;
    } else {
      throw new Error("Missing user_id");
    }

    const { affectedRows } = await dbHelper.executeQuery(query, [value]);
    return affectedRows;
  }
}

module.exports = new Chat();
