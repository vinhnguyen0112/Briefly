const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");

class Session {
  /**
   * Insert a session into the database
   * @param {Object} sessionData Session's data object
   */
  async create(sessionData) {
    sessionData = cleanDeep(sessionData);
    const columns = Object.keys(sessionData).join(", ");
    const placeholders = Object.keys(sessionData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(sessionData);

    const query = `INSERT INTO sessions (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  /**
   * Get a session by ID from the database.
   * @param {String} id ID of the session
   * @returns {Promise<Object>} Session object
   */
  async getById(id) {
    const query = "SELECT * FROM sessions WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Update a session in the database
   * @param {String} id ID of the session to update
   * @param {Object} updates Update values object
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
    // Refresh session TTL on update
    fields.push("expires_at = CURRENT_TIMESTAMP + INTERVAL 7 DAY");
    const query = `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }

  /**
   * Delete a session by ID from the database.
   * @param {String} id ID of the session to delete
   * @returns {Promise<number>} Number of affected rows
   */
  async delete(id) {
    const query = "DELETE FROM sessions WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }
}

module.exports = new Session();
