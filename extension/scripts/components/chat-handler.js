import { getUserSession, getAnonSession } from "./state.js";

const API_BASE = "http://localhost:3000/api/chats";

// Helper: send request with session (auth or anon)
async function sendRequestWithSession(url, options = {}) {
  // Try to get authenticated session first
  const userSession = await getUserSession();
  let sessionId = userSession ? `auth:${userSession.id}` : null;

  // If no auth session, try anon session
  if (!sessionId) {
    const anonSession = await getAnonSession();
    if (anonSession) {
      sessionId = `anon:${anonSession.id}`;
    }
  }

  if (!sessionId) throw new Error("No active session found");

  // Set authorization header
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${sessionId}`);

  // Default to JSON content type
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
    const errorText = await response.text();
    throw new Error(
      `Request failed with status ${response.status}: ${errorText}`
    );
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
async function getChatsByUser(user_id) {
  return sendRequestWithSession(`${API_BASE}/user/${user_id}`).then(
    (data) => data.data
  );
}

// Get all chats for an anonymous session
async function getChatsByAnonSession(anon_session_id) {
  return sendRequestWithSession(`${API_BASE}/anon/${anon_session_id}`).then(
    (data) => data.data
  );
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
async function addMessage(chat_id, { role, content, model }) {
  return sendRequestWithSession(`${API_BASE}/${chat_id}/messages`, {
    method: "POST",
    body: { role, content, model },
  }).then((data) => data.data);
}

// Get all messages for a chat
async function getMessages(chat_id) {
  return sendRequestWithSession(`${API_BASE}/${chat_id}/messages`).then(
    (data) => data.data
  );
}

// Get a single message by ID
async function getMessageById(chat_id, message_id) {
  return sendRequestWithSession(
    `${API_BASE}/${chat_id}/messages/${message_id}`
  ).then((data) => data.data);
}

// Delete a message
async function deleteMessage(chat_id, message_id) {
  return sendRequestWithSession(
    `${API_BASE}/${chat_id}/messages/${message_id}`,
    {
      method: "DELETE",
    }
  );
}

const chatHandler = {
  createChat,
  getChatById,
  getChatsByUser,
  getChatsByAnonSession,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  getMessageById,
  deleteMessage,
};

export default chatHandler;
