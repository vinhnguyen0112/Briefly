const dbHelper = require("../helpers/dbHelper");

/**
 * @typedef {Object} PageObject
 * @property {string} id
 * @property {string} page_url
 * @property {string} title
 * @property {Object} [page_content]
 * @property {Date} [created_at]
 * @property {Date} [updated_at]
 */

class Page {
  /**
   * Insert a page into the database.
   * Ignored if a record already exists
   * @param {PageObject} pageData
   * @param {String} pageData.id
   * @param {String} pageData.title
   * @param {String} pageData.page_url
   * @param {String} pageData.page_content
   * @returns {Promise<PageObject|null>} The inserted page object or null if ignored
   */
  async create(pageData) {
    if (!pageData || Object.keys(pageData).length === 0) return null;

    const columns = Object.keys(pageData).join(", ");
    const placeholders = Object.keys(pageData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(pageData);

    const query = `INSERT IGNORE INTO pages (${columns}) VALUES (${placeholders})`;
    const result = await dbHelper.executeQuery(query, values);

    if (result.affectedRows === 0) {
      // Insert ignored
      return null;
    }

    // Return full page object
    return pageData;
  }

  /**
   * Get a page by ID
   * Returns null if not found
   * @param {string} id
   * @returns {Promise<PageObject|null>}
   */
  async getById(id) {
    const query = "SELECT * FROM pages WHERE id = ?";
    const rows = await dbHelper.executeQuery(query, [id]);
    return rows[0] ?? null;
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

  /**
   * Delete a page and its associated summaries.
   * @param {String} id
   */
  async deleteById(id) {
    const query = `DELETE FROM pages WHERE id = ?`;
    await dbHelper.executeQuery(query, [id]);
  }
}

module.exports = new Page();
