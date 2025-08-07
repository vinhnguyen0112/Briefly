const dbHelper = require("../helpers/dbHelper");

class Note {
  /**
   * Insert a note into the database
   * @param {Object} noteData Note data object
   * @param {String} [noteData.id]
   * @param {String} [noteData.user_id]
   * @param {String} [noteData.page_url]
   * @param {String} [noteData.note]
   */
  async create(noteData) {
    if (!noteData || Object.keys(noteData).length <= 0) return;

    const columns = Object.keys(noteData).join(", ");
    const placeholders = Object.keys(noteData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(noteData);

    const query = `INSERT INTO notes (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  /**
   * Get notes by user ID and page URL with pagination
   * @param {String} userId
   * @param {String} pageUrl
   * @param {Number} offset
   * @param {Number} limit
   * @returns {Promise<Array>}
   */
  async getByUserAndPagePaginated(userId, pageUrl, offset = 0, limit = 20) {
    const query = `
      SELECT * FROM notes 
      WHERE user_id = ? AND page_url = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = await dbHelper.executeQuery(query, [
      userId, // WHERE user_id = ?
      pageUrl, // AND page_url = ?
      limit, // LIMIT ?
      offset, // OFFSET ?
    ]);
    return rows;
  }

  /**
   * Get all notes by user ID with pagination
   * @param {String} userId
   * @param {Number} offset
   * @param {Number} limit
   * @returns {Promise<Array>}
   */
  async getByUserPaginated(userId, offset = 0, limit = 20) {
    const query = `
      SELECT * FROM notes 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = await dbHelper.executeQuery(query, [
      userId, // WHERE user_id = ?
      limit, // LIMIT ?
      offset, // OFFSET ?
    ]);
    return rows;
  }

  /**
   * Get notes by user ID and page URL (deprecated - use paginated version)
   * @param {String} userId
   * @param {String} pageUrl
   * @returns {Promise<Array>}
   */
  async getByUserAndPage(userId, pageUrl) {
    const query =
      "SELECT * FROM notes WHERE user_id = ? AND page_url = ? ORDER BY created_at DESC";
    const rows = await dbHelper.executeQuery(query, [userId, pageUrl]);
    return rows;
  }

  /**
   * Get all notes by user ID (deprecated - use paginated version)
   * @param {String} userId
   * @returns {Promise<Array>}
   */
  async getByUser(userId) {
    const query =
      "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC";
    const rows = await dbHelper.executeQuery(query, [userId]);
    return rows;
  }

  /**
   * Update a note
   * @param {String} id
   * @param {Object} updates
   * @returns {Promise<number>}
   */
  async update(id, updates) {
    if (!updates || Object.keys(updates).length <= 0) return 0;

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE notes SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }

  /**
   * Delete a note
   * @param {String} id
   * @returns {Promise<number>}
   */
  async delete(id) {
    const query = "DELETE FROM notes WHERE id = ?";
    const { affectedRows } = await dbHelper.executeQuery(query, [id]);
    return affectedRows;
  }

  /**
   * Get a note by ID
   * @param {String} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const query = "SELECT * FROM notes WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }
}

module.exports = new Note();
