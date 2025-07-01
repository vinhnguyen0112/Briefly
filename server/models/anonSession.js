const dbHelper = require("../helpers/dbHelper");

class AnonSession {
  /**
   * Insert an anonymous session into the database.
   * @param {Object} sessionData The session data object
   * @param {number} [sessionData.anon_query_count]
   */
  async create(sessionData) {
    if (!sessionData || Object.keys(sessionData).length <= 0) return;

    const columns = Object.keys(sessionData).join(", ");
    const placeholders = Object.keys(sessionData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(sessionData);

    const query = `INSERT INTO anon_sessions (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  /**
   * Get an anonymous session by ID.
   * @param {String} id ID of the anonymous session to get
   * @returns {Promise<Object>} Anonymous session object
   */
  async getById(id) {
    const query = "SELECT * FROM anon_sessions WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Update an anonymous session in the database.
   * @param {String} id ID of the anonymous session to update
   * @param {Object} updates Update values object
   * @param {number} [sessionData.anon_query_count]
   * @returns {Promise<number>} Number of affected rows
   */
  async update(id, updates) {
    if (!updates || Object.keys(updates).length <= 0) return 0;

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    if (fields.length === 0) return;
    // Refresh session TTL on update
    fields.push("expires_at = CURRENT_TIMESTAMP + INTERVAL 7 DAY");
    const query = `UPDATE anon_sessions SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }

  /**
   * Delete an anonymous session from the database.
   * @param {String} id ID of the anonymous session to delete
   * @returns {Promise<number>} Number of affected rows
   */
  async delete(id) {
    const query = "DELETE FROM anon_sessions WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }
}

module.exports = new AnonSession();
