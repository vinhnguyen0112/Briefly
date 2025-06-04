import { getUserSession, getAnonSession } from "./state.js";

const API_BASE = "http://localhost:3000/api/chats";

// Helper: send request with session (auth or anon)
async function sendRequestWithSession(url, options = {}) {
  // Get user or anon session
  const userSession = await getUserSession();
  const anonSession = !userSession && (await getAnonSession());
  const sessionId = userSession?.id || anonSession?.id;

  if (!sessionId) throw new Error("No active session found");

  // Prepare headers
  const headers = new Headers(options.headers);
  headers.set(
    "Authorization",
    `Bearer ${userSession ? `auth:${sessionId}` : `anon:${sessionId}`}`
  );

  // JSON body handling
  if (
    options.body &&
    typeof options.body === "object" &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

// Create a new chat (for anon or authenticated user)
async function createChat({ id, page_url, title }) {
  return sendRequestWithSession(API_BASE, {
    method: "POST",
    body: { id, page_url, title },
  }).then((data) => data.data);
}

// Get a chat by ID
async function getChatById(id) {
  return sendRequestWithSession(`${API_BASE}/${id}`).then((data) => data.data);
}

// Get all chats for a user
async function getChatsForCurrentUser({ offset = 0, limit = 20 }) {
  return sendRequestWithSession(
    `${API_BASE}?offset=${offset}&limit=${limit}`
  ).then((data) => data.data);
}

// Update a chat
async function updateChat(id, updates) {
  return sendRequestWithSession(`${API_BASE}/${id}`, {
    method: "PUT",
    body: updates,
  });
}

// Delete a chat
async function deleteChat(id) {
  return sendRequestWithSession(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
}

// Add a message to a chat
async function addMessage(chatId, { role, content, model }) {
  return sendRequestWithSession(`${API_BASE}/${chatId}/messages`, {
    method: "POST",
    body: { role, content, model },
  }).then((data) => data.data);
}

// Get all messages for a chat
async function getMessages(chatId) {
  return sendRequestWithSession(`${API_BASE}/${chatId}/messages`).then(
    (data) => data.data
  );
}

// Delete a message
async function deleteMessage(chatId, messageId) {
  return sendRequestWithSession(`${API_BASE}/${chatId}/messages/${messageId}`, {
    method: "DELETE",
  });
}

const chatHandler = {
  createChat,
  getChatById,
  getChatsForCurrentUser,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  deleteMessage,
};

export default chatHandler;
