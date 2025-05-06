// These are all template code

const db = require("../helpers/dbHelper");

/**
 * Get all queries for a specific conversation
 * @param {number} conversationId - The ID of the conversation
 * @returns {Promise} A promise that resolves to an array of queries
 */
async function getQueriesByConversationId(conversationId) {
  const query = "SELECT * FROM queries WHERE conversation_id = ?";
  return db.executeQuery(query, [conversationId]);
}

/**
 * Create a new query
 * @param {Object} queryData - The query data
 * @returns {Promise} A promise that resolves to the ID of the new query
 */
async function createQuery(queryData) {
  const query = `
    INSERT INTO queries (conversation_id, query, response, model, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;
  const result = await db.executeQuery(query, [
    queryData.conversation_id,
    queryData.query,
    queryData.response,
    queryData.model,
  ]);
  return result.insertId; // Return the ID of the newly created query
}

module.exports = {
  getQueriesByConversationId,
  createQuery,
};
