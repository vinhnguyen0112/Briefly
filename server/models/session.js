const dbHelper = require("../helpers/dbHelper");

class Session {
  async create(sessionData) {
    const columns = Object.keys(sessionData).join(", ");
    const placeholders = Object.keys(sessionData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(sessionData);

    const query = `INSERT INTO sessions (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  async getById(id) {
    const query = "SELECT * FROM sessions WHERE id = ?";
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
    const query = `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    await dbHelper.executeQuery(query, values);
  }

  async delete(id) {
    const query = "DELETE FROM sessions WHERE id = ?";
    console.log("Received id in deleting query: ", id);
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Session();
