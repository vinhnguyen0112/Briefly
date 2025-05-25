const dbHelper = require("../helpers/dbHelper");

class Session {
  async create(sessionId, userId) {
    const query = "INSERT INTO sessions (id, user_id) VALUES (?, ?)";
    await dbHelper.executeQuery(query, [sessionId, userId]);
  }

  async getById(id) {
    const query = "SELECT * FROM sessions WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  async update(id, updates) {
    const query = "UPDATE sessions SET expires_at = ? WHERE id = ?";
    await dbHelper.executeQuery(query, [updates.expires_at, id]);
  }

  async delete(id) {
    const query = "DELETE FROM sessions WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Session();
