import { getUserSession, sendRequest } from "./state.js";

const API_BASE = "http://localhost:3000/api/chats";

// Create a new chat
async function createChat({ id, page_url, title }) {
  const response = sendRequest(API_BASE, {
    method: "POST",
    body: { id, page_url, title },
  });

  return response;
}

// Get all chats for a user
async function getChatsForCurrentUser({ offset = 0, limit = 20 }) {
  const userSession = await getUserSession();

  if (!userSession) throw new Error("No authenticated user session found");
  const response = await fetch(`${API_BASE}?offset=${offset}&limit=${limit}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer auth:${userSession.id}`,
    },
  });

  const data = await response.json();

  return data.data;
}

/**
 * Update a chat by ID
 * @param {String} id ID of the chat to update
 * @param {Object | FormData} updates Update values as object
 * @returns
 */
async function updateChat(id, updates) {
  return await sendRequest(`${API_BASE}/${id}`, {
    method: "PUT",
    body: updates,
  });
}

// Delete a chat
async function deleteChat(id) {
  return await sendRequest(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
}

/**
 * Delete all chats of the current signed in session
 */
async function deleteAllChatsOfCurrentUser() {
  return await sendRequest(`${API_BASE}`, {
    method: "DELETE",
  });
}

/**
 * @typedef {Object} CreateMessageBody
 * @property {String} role
 * @property {String} content
 * @property {String} [model]
 */

/**
 * Add a message to a chat
 * @param {String} chatId ID of the chat
 * @param {CreateMessageBody} messageBody Mesage body
 * @returns
 */
async function addMessage(chatId, messageBody) {
  const { role, content, model } = messageBody;
  const response = await sendRequest(`${API_BASE}/${chatId}/messages`, {
    method: "POST",
    body: { role, content, model },
  });

  console.log("add message response: ", response);
  return response.data;
}

// Get all messages for a chat
async function getMessages(chatId) {
  const response = await sendRequest(`${API_BASE}/${chatId}/messages`);
  console.log(response);
  return response;
}

const chatHandler = {
  createChat,
  getChatsForCurrentUser,
  updateChat,
  deleteChat,
  deleteAllChatsOfCurrentUser,
  addMessage,
  getMessages,
};

export default chatHandler;
