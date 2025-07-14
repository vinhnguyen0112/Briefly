const dbHelper = require("../helpers/dbHelper");

class Page {
  /**
   * Insert a page into the database.
   * @param {Object} pageData Page data object to insert
   * @param {String} pageData.id
   * @param {String} pageData.page_url
   * @param {String} pageData.title
   * @param {String} pageData.summary
   * @param {Object} [pageData.suggested_questions]
   */
  async create(pageData) {
    if (!pageData || Object.keys(pageData).length <= 0) return;

    const columns = Object.keys(pageData).join(", ");
    const placeholders = Object.keys(pageData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(pageData);

    const query = `INSERT INTO pages (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }

  /**
   * Get a page by ID
   * @param {String} id
   * @returns {Promise<Object>} Page object
   */
  async getById(id) {
    const query = "SELECT * FROM pages WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0];
  }

  /**
   * Update a page
   * @param {String} id
   * @param {Object} updates
   * @returns {Promise<number>} Number of affected rows
   */
  async update(id, updates) {
    if (!updates || Object.keys(updates).length <= 0) return;

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    if (fields.length === 0) return;
    // Always update updated_at timestamp
    fields.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE pages SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    const { affectedRows } = await dbHelper.executeQuery(query, values);
    return affectedRows;
  }
}

module.exports = new Page();
