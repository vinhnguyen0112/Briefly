import { sendRequestWithSession } from "./auth-handler";

const API_BASE = "http://localhost:3000/api/chats";

// TODO: Send auth_session_id or anon_session_id in header instead. Do this for all functions.
// Create a new chat (for anon or authenticated user)
async function createChat({ page_url, title }) {
  // const sessionId = await getCurrentSessionId();
  // if (!sessionId) throw new Error("No active session found");

  // const response = await fetch(API_BASE, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${sessionId}`,
  //   },
  //   body: JSON.stringify({ page_url, title }),
  // });
  // if (!response.ok) throw new Error("Failed to create chat");
  // const data = await response.json();
  // return data.data;

  const data = await sendRequestWithSession(API_BASE, {
    method: "POST",
    body: { page_url, title },
  });

  return data.data;
}

// Get a chat by ID
async function getChatById(id) {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error("Failed to get chat");
  const data = await response.json();
  return data.data;
}

// Get all chats for a user
async function getChatsByUser(user_id) {
  const response = await fetch(`${API_BASE}/user/${user_id}`);
  if (!response.ok) throw new Error("Failed to get user chats");
  const data = await response.json();
  return data.data;
}

// Get all chats for an anonymous session
async function getChatsByAnonSession(anon_session_id) {
  const response = await fetch(`${API_BASE}/anon/${anon_session_id}`);
  if (!response.ok) throw new Error("Failed to get anon chats");
  const data = await response.json();
  return data.data;
}

// Update a chat
async function updateChat(id, updates) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update chat");
  return await response.json();
}

// Delete a chat
async function deleteChat(id) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete chat");
  return await response.json();
}

// Add a message to a chat
async function addMessage(chat_id, { role, content, model }) {
  const res = await fetch(`${API_BASE}/${chat_id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content, model }),
  });
  if (!res.ok) throw new Error("Failed to add message");
  const data = await res.json();
  return data.data; // { id }
}

// Get all messages for a chat
async function getMessages(chat_id) {
  const res = await fetch(`${API_BASE}/${chat_id}/messages`);
  if (!res.ok) throw new Error("Failed to get messages");
  const data = await res.json();
  return data.data;
}

// Get a single message by ID
async function getMessageById(chat_id, message_id) {
  const res = await fetch(`${API_BASE}/${chat_id}/messages/${message_id}`);
  if (!res.ok) throw new Error("Failed to get message");
  const data = await res.json();
  return data.data;
}

// Delete a message
async function deleteMessage(chat_id, message_id) {
  const res = await fetch(`${API_BASE}/${chat_id}/messages/${message_id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete message");
  return await res.json();
}

const ChatHandler = {
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

export default ChatHandler;
