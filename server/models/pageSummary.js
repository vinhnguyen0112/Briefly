const dbHelper = require("../helpers/dbHelper");

class PageSummary {
  /**
   * Insert a page summary.
   * @param {Object} data
   * @param {String} data.page_id
   * @param {String} data.language
   * @param {String} data.summary
   * @returns {Promise<{insertId: number, affectedRows: number}>} Inserted summary's ID & number of affected rows
   */
  async insert(data) {
    const { page_id, language, summary } = data;

    const query = `
      INSERT IGNORE INTO page_summaries (page_id, language, summary) VALUES (?, ?, ?)
    `;
    const values = [page_id, language, summary];
    const result = await dbHelper.executeQuery(query, values);
    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Get summary by page_id and language.
   * @param {String} page_id
   * @param {String} language
   * @returns {Promise<Object|null>}
   */
  async getByPageIdAndLanguage(page_id, language) {
    const query = `SELECT * FROM page_summaries WHERE page_id = ? AND language = ?`;
    const rows = await dbHelper.executeQuery(query, [page_id, language]);
    return rows[0] || null;
  }

  /**
   * Delete summary by page_id and language.
   * @param {String} page_id
   * @param {String} language
   * @returns {Promise<number>} Number of affected rows
   */
  async deleteByPageIdAndLanguage(page_id, language) {
    const query = `DELETE FROM page_summaries WHERE page_id = ? AND language = ?`;
    const { affectedRows } = await dbHelper.executeQuery(query, [
      page_id,
      language,
    ]);

    return affectedRows;
  }

  /**
   * Delete all summaries by page_id.
   * @param {String} page_id
   * @returns {Promise<number>} Number of affected rows
   */
  async deleteAllByPageId(page_id) {
    const query = `DELETE FROM page_summaries WHERE page_id = ?`;
    const { affectedRows } = await dbHelper.executeQuery(query, [page_id]);
    return affectedRows;
  }
}

module.exports = new PageSummary();
