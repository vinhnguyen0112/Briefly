const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");

class AnonSession {
  async create(data) {
    data = cleanDeep(data);
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const query = `INSERT INTO anon_sessions (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  async getById(id) {
    const query = "SELECT * FROM anon_sessions WHERE id = ?";
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
    // Refresh session TTL on update
    fields.push("expires_at = CURRENT_TIMESTAMP + INTERVAL 7 DAY");
    const query = `UPDATE anon_sessions SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    await dbHelper.executeQuery(query, values);
  }

  async delete(id) {
    const query = "DELETE FROM anon_sessions WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new AnonSession();
