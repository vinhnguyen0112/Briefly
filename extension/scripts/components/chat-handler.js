import { getUserSession, sendRequest } from "./state.js";

const API_BASE = "http://localhost:3000/api/chats";

/**
 * Create a new chat.
 * @param {Object} chatData Chat data.
 * @param {string} chatData.id Chat ID.
 * @param {string} chatData.page_url Page URL.
 * @param {string} chatData.title Chat title.
 * @returns {Promise<Object>} The created chat response.
 */
async function createChat({ id, page_url, title }) {
  const response = await sendRequest(API_BASE, {
    method: "POST",
    body: { id, page_url, title },
  });

  return response;
}

/**
 * Get all chats for the current user.
 * @param {Object} params Query parameters.
 * @param {number} [params.offset=0] Offset for pagination.
 * @param {number} [params.limit=20] Limit for pagination.
 * @returns {Promise<Array>} Array of chat objects.
 * @throws {Error} If user session is not found.
 */
async function getChatsForCurrentUser({ offset = 0, limit = 20 } = {}) {
  const userSession = await getUserSession();
  if (!userSession) throw new Error("No authenticated user session found");
  const response = await fetch(`${API_BASE}?offset=${offset}&limit=${limit}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer auth:${userSession.id}`,
    },
  });

  const data = await response.json();
  return data;
}

/**
 * Update a chat by ID.
 * @param {string} id ID of the chat to update.
 * @param {Object|FormData} updates Update values as object or FormData.
 * @returns {Promise<Object>} The updated chat response.
 */
async function updateChat(id, updates) {
  const response = await sendRequest(`${API_BASE}/${id}`, {
    method: "PUT",
    body: updates,
  });

  return response;
}

/**
 * Delete a chat by ID.
 * @param {string} id ID of the chat to delete.
 * @returns {Promise<Object>} The delete response.
 */
async function deleteChatById(id) {
  const response = await sendRequest(`${API_BASE}/${id}`, {
    method: "DELETE",
  });

  return response;
}

/**
 * Delete all chats of the current signed in session.
 * @returns {Promise<Object>} The delete response.
 */
async function deleteAllChatsOfCurrentUser() {
  const response = await sendRequest(`${API_BASE}`, {
    method: "DELETE",
  });

  return response;
}

/**
 * @typedef {Object} CreateMessageBody
 * @property {string} role Role of the message sender.
 * @property {string} content Content of the message.
 * @property {string} [model] Optional model info.
 */

/**
 * Add a message to a chat.
 * @param {string} chatId ID of the chat.
 * @param {CreateMessageBody} messageBody Message body.
 * @returns {Promise<Object>} The added message data.
 */
async function addMessage(chatId, messageBody) {
  const { role, content, model } = messageBody;
  const response = await sendRequest(`${API_BASE}/${chatId}/messages`, {
    method: "POST",
    body: { role, content, model },
  });

  return response;
}

/**
 * Get all messages of a chat.
 * @param {string} chatId ID of the chat.
 * @returns {Promise<Object>} The messages response.
 */
async function getMessagesOfChat(chatId) {
  const response = await sendRequest(`${API_BASE}/${chatId}/messages`);
  return response;
}

const chatHandler = {
  createChat,
  getChatsForCurrentUser,
  updateChat,
  deleteChatById,
  deleteAllChatsOfCurrentUser,
  addMessage,
  getMessagesOfChat,
};

export default chatHandler;
