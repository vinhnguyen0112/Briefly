import { getUserSession, sendRequest } from "./state.js";

const API_BASE = "https://dev-capstone-2025.coccoc.com/api/chats";

/**
 * Create a new chat.
 * @param {Object} chatData Chat data.
 * @param {string} chatData.page_url Page URL.
 * @param {string} chatData.title Chat title.
 * @returns {Promise<Object>} The created chat response.
 */
async function createChat({ page_url, title }) {
  const response = await sendRequest(API_BASE, {
    method: "POST",
    body: { page_url, title },
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

  const response = await sendRequest(
    `${API_BASE}?offset=${offset}&limit=${limit}`,
    {
      method: "GET",
    }
  );
  return response;
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
 * Add a pair of messages to a chat atomically.
 * @param {string} chatId
 * @param {Array<Object>} messages Array of messages [{role, content, model?}, ...]
 * @returns {Promise<Object>} The added messages data.
 */
async function addMessagePair(chatId, messages) {
  const response = await sendRequest(`${API_BASE}/${chatId}/messages/pair`, {
    method: "POST",
    body: { messages },
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
  addMessagePair,
  getMessagesOfChat,
};

export default chatHandler;
