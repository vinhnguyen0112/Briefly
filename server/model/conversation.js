// These are all template code

const db = require("../helpers/dbHelper");

/**
 * Get all conversations
 * @returns {Promise} A promise that resolves to an array of conversations
 */
async function getAllConversations() {
  const query = "SELECT * FROM conversations";
  return db.executeQuery(query);
}

/**
 * Get a conversation by ID
 * @param {number} id - The ID of the conversation
 * @returns {Promise} A promise that resolves to the conversation object
 */
async function getConversationById(id) {
  const query = "SELECT * FROM conversations WHERE id = ?";
  return db.executeQuery(query, [id]);
}

/**
 * Create a new conversation
 * @param {Object} conversation - The conversation data
 * @returns {Promise} A promise that resolves to the ID of the new conversation
 */
async function createConversation(conversation) {
  const query = `
    INSERT INTO conversations (title, page_url, user_id, created_at, updated_at)
    VALUES (?, ?, ?, NOW(), NOW())
  `;
  const result = await db.executeQuery(query, [
    conversation.title,
    conversation.page_url,
    conversation.user_id,
  ]);
  return result.insertId; // Return the ID of the newly created conversation
}

module.exports = {
  getAllConversations,
  getConversationById,
  createConversation,
};
