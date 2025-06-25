import { getUserSession, sendRequest } from "./state.js";

const API_BASE = "http://localhost:3000/api/chats";

// Create a new chat
async function createChat({ id, page_url, title }) {
  return sendRequest(API_BASE, {
    method: "POST",
    body: { id, page_url, title },
  }).then((data) => data.data);
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

// Update a chat
async function updateChat(id, updates) {
  return sendRequest(`${API_BASE}/${id}`, {
    method: "PUT",
    body: updates,
  });
}

// Delete a chat
async function deleteChat(id) {
  return sendRequest(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
}

// Add a message to a chat
async function addMessage(chatId, { role, content, model }) {
  return sendRequest(`${API_BASE}/${chatId}/messages`, {
    method: "POST",
    body: { role, content, model },
  }).then((data) => data.data);
}

// Get all messages for a chat
async function getMessages(chatId) {
  return sendRequest(`${API_BASE}/${chatId}/messages`).then(
    (data) => data.data
  );
}

const chatHandler = {
  createChat,
  getChatsForCurrentUser,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
};

export default chatHandler;
