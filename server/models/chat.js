const dbHelper = require("../helpers/dbHelper");

class Chat {
  async create(chatData) {
    const { id, user_id, anon_session_id, title } = chatData;
    const query = `
      INSERT INTO chats (id, user_id, anon_session_id, title)
      VALUES (?, ?, ?, ?)
    `;
    await dbHelper.executeQuery(query, [id, user_id, anon_session_id, title]);
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
