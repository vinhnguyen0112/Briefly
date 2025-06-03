const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");
class Chat {
  // TODO: Test this with extension
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

  async getById(id) {
    const query = "SELECT * FROM chats WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  async getByUserId(user_id) {
    const query = "SELECT * FROM chats WHERE user_id = ?";
    return dbHelper.executeQuery(query, [user_id]);
  }

  async getByAnonSessionId(anon_session_id) {
    const query = "SELECT * FROM chats WHERE anon_session_id = ?";
    return dbHelper.executeQuery(query, [anon_session_id]);
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
    const query = `UPDATE chats SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    await dbHelper.executeQuery(query, values);
  }

  async updateAnonChatsToUser(anon_session_id, user_id) {
    const query = `
      UPDATE chats
      SET user_id = ?, anon_session_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE anon_session_id = ?
    `;
    await dbHelper.executeQuery(query, [user_id, anon_session_id]);
  }

  async delete(id) {
    const query = "DELETE FROM chats WHERE id = ?";
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Chat();
