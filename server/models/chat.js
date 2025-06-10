const cleanDeep = require("clean-deep");
const dbHelper = require("../helpers/dbHelper");
class Chat {
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

  // Bulk insert chats
  async bulkInsert(chats) {
    if (!Array.isArray(chats) || chats.length === 0) return;
    // Assume all chats have the same keys
    const columns = Object.keys(chats[0]);
    const placeholders = "(" + columns.map(() => "?").join(", ") + ")";
    const allPlaceholders = chats.map(() => placeholders).join(", ");
    const values = chats.flatMap((chat) => columns.map((col) => chat[col]));

    const query = `INSERT INTO chats (${columns.join(
      ", "
    )}) VALUES ${allPlaceholders}`;
    await dbHelper.executeQuery(query, values);
  }

  async getById(id) {
    const query = "SELECT * FROM chats WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  async getBy({ user_id, anon_session_id, offset = 0, limit = 20 }) {
    let query = "SELECT * FROM chats";
    const conditions = [];
    const values = [];

    if (user_id) {
      conditions.push("user_id = ?");
      values.push(user_id);
    }
    if (anon_session_id) {
      conditions.push("anon_session_id = ?");
      values.push(anon_session_id);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    // Increase LIMIT by 1 to determine hasMore
    values.push((parseInt(limit) + 1).toString(), offset);

    return dbHelper.executeQuery(query, values);
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

  async deleteBy({ user_id, anon_session_id }) {
    let query = "DELETE FROM chats ";
    let value;

    if (user_id) {
      query += `WHERE user_id = ?`;
      value = user_id;
    } else if (anon_session_id) {
      query += `WHERE anon_session_id = ?`;
      value = anon_session_id;
    } else {
      throw new Error("Missing both user_id and anon_session_id");
    }

    await dbHelper.executeQuery(query, [value]);
  }
}

module.exports = new Chat();
