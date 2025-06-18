const dbHelper = require("../helpers/dbHelper");

class User {
  async create(userData) {
    const { id, name } = userData;
    const query = `
      INSERT INTO users (id, name) VALUES (?, ?)
    `;
    await dbHelper.executeQuery(query, [id, name]);
  }

  async getById(id) {
    const query = "SELECT * FROM users WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

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
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    await dbHelper.executeQuery(query, values);
  }

  async delete(id) {
    const query = "DELETE FROM users WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new User();
