const dbHelper = require("../helpers/dbHelper");

class Session {
  async create(sessionData) {
    const { session_id, user_id, expires_at } = sessionData;
    const query =
      "INSERT INTO session (session_id, user_id, expires_at) VALUES (?, ?, ?)";
    await dbHelper.executeQuery(query, [session_id, user_id, expires_at]);
  }

  async getById(session_id) {
    const query = "SELECT * FROM session WHERE session_id = ?";
    const rows = await dbHelper.executeQuery(query, [session_id]);
    return rows[0];
  }

  async update(session_id, updates) {
    const query = "UPDATE session SET expires_at = ? WHERE session_id = ?";
    await dbHelper.executeQuery(query, [updates.expires_at, session_id]);
  }

  async delete(session_id) {
    const query = "DELETE FROM session WHERE session_id = ?";
    await dbHelper.executeQuery(query, [session_id]);
  }
}

module.exports = new Session();
