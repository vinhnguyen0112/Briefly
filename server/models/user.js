const dbHelper = require("../helpers/dbHelper");

class User {
  /**
   * Insert an user into the database.
   * @param {Object} userData User data object
   */
  async create(userData) {
    if (!userData || Object.keys(userData).length <= 0) return;

    const { id, name } = userData;
    const query = `
      INSERT INTO users (id, name) VALUES (?, ?)
    `;
    await dbHelper.executeQuery(query, [id, name]);
  }

  /**
   * Get an user by ID in the database
   * @param {String} id ID of the user
   * @returns {Promise<Object>} User object
   */
  async getById(id) {
    const query = "SELECT * FROM users WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Update an user in the database
   * @param {String} id ID of the user
   * @param {Object} updates Update values
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
    // Always update updated_at timestamp
    fields.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }

  /**
   * Delete an user in the database
   * @param {String} id ID of the user
   * @returns {Promise<number>} Number of affected rows
   */
  async delete(id) {
    const query = "DELETE FROM users WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }
}

module.exports = new User();
