const dbHelper = require("../helpers/dbHelper");

class Feedback {
  /**
   * Insert feedback into the database.
   * @param {Object} feedbackData
   * @param {String} [feedbackData.id]
   * @param {String} [feedbackData.message_id]
   * @param {String} [feedbackData.user_id]
   * @param {number} [feedbackData.stars]
   * @param {String} [feedbackData.comment]
   * @param {Date} [feedbackData.created_at]
   * @returns {Promise<void>}
   */
  async create(feedbackData) {
    if (!feedbackData || Object.keys(feedbackData).length === 0) return;

    const columns = Object.keys(feedbackData).join(", ");
    const placeholders = Object.keys(feedbackData)
      .map(() => "?")
      .join(", ");
    const values = Object.values(feedbackData);

    const query = `INSERT INTO feedbacks (${columns}) VALUES (${placeholders})`;
    await dbHelper.executeQuery(query, values);
  }
}

module.exports = new Feedback();
