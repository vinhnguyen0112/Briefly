const DB_NAME = "briefly_db";
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database and sets up object stores if needed.
 * @returns {Promise} A promise that resolves with the database instance
 **/
async function openIndexedDB() {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log("IndexedDB upgrade needed");
      setupObjectStores(db);
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log(`IndexedDB '${DB_NAME}' opened successfully`);
      resolve({ db });
    };

    request.onerror = (event) => {
      console.error("Error opening IndexedDB:", event.target.error);
      reject(new Error("Database setup failed: " + event.target.error.message));
    };
  });
}

// Set up object stores for the database
function setupObjectStores(db) {
  console.log("Setting up object stores");

  // Create "chats" object store if needed
  if (!db.objectStoreNames.contains("chats")) {
    const chatsStore = db.createObjectStore("chats", {
      keyPath: "id", // Primary key
    });

    // Define indexes
    chatsStore.createIndex("title", "title", { unique: false });
    chatsStore.createIndex("created_at", "created_at", { unique: false });
    chatsStore.createIndex("updated_at", "updated_at", { unique: false });
    chatsStore.createIndex("page_url", "page_url", { unique: false });
  }

  console.log("Object stores created successfully");
}

/**
 * Adds a new chat to the "chats" object store.
 * @param {Object} chat - The chat object to store.
 * @returns {Promise<string>} - Resolves with the ID of the new chat.
 */
async function addChat(chat) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");

    // If no id, generate one (UUID)
    if (!chat.id) {
      chat.id = crypto.randomUUID();
    }
    chat.title = chat.title || "Untitled";
    chat.page_url = chat.page_url || "";
    chat.created_at = chat.created_at || new Date();
    chat.updated_at = chat.updated_at || new Date();

    const request = store.add(chat);

    request.onsuccess = () => {
      console.log("Chat added with ID:", chat.id);
      resolve(chat.id);
    };

    request.onerror = (event) => {
      console.error("Error adding chat:", event.target.error);
      reject(new Error("Failed to add chat: " + event.target.error.message));
    };
  });
}

/**
 * Adds a new message to the messages array of a chat in the "chats" object store.
 * @param {Object} message - The message object to store. Must include chat_id.
 * @returns {Promise<void>}
 */
async function addMessage(chatId, message) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    if (!chatId) {
      reject(new Error("Chat ID is required to add a message"));
      return;
    }
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");
    const getRequest = store.get(chatId);

    getRequest.onsuccess = (event) => {
      const chat = event.target.result;
      if (!chat) {
        reject(new Error(`Chat with ID ${chatId} does not exist`));
        return;
      }

      // If no messages array, initialize it
      if (!Array.isArray(chat.messages)) chat.messages = [];

      // Add the new message
      chat.messages.push({
        ...message,
        created_at: message.created_at || new Date(),
      });
      chat.updated_at = new Date();

      const updateRequest = store.put(chat);
      updateRequest.onsuccess = () => {
        console.log(`Message added to chat ${chatId}`);
        resolve();
      };
      updateRequest.onerror = (event) => {
        console.error("Error adding message to chat:", event.target.error);
        reject(
          new Error("Failed to add message: " + event.target.error.message)
        );
      };
    };

    getRequest.onerror = (event) => {
      console.error("Error fetching chat:", event.target.error);
      reject(new Error("Failed to fetch chat: " + event.target.error.message));
    };
  });
}

/**
 * Adds multiple messages to the messages array of a chat in the "chats" object store.
 * @param {string} chatId - The ID of the chat to add messages to.
 * @param {Array<Object>} messages - Array of message objects to add.
 * @returns {Promise<void>}
 */
async function addMessagesToChat(chatId, messages) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    if (!chatId) {
      reject(new Error("Chat ID is required to add messages"));
      return;
    }
    if (!Array.isArray(messages)) {
      reject(new Error("Messages must be an array"));
      return;
    }
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");
    const getRequest = store.get(chatId);

    getRequest.onsuccess = (event) => {
      const chat = event.target.result;
      if (!chat) {
        reject(new Error(`Chat with ID ${chatId} does not exist`));
        return;
      }
      if (!Array.isArray(chat.messages)) chat.messages = [];
      // Simplify message structure
      messages.forEach((msg) => {
        chat.messages.push({
          role: msg.role,
          content: msg.content,
          model: msg.model,
          created_at: msg.created_at,
        });
      });
      chat.updated_at = new Date();

      const updateRequest = store.put(chat);
      updateRequest.onsuccess = () => {
        console.log(`Added ${messages.length} messages to chat ${chatId}`);
        resolve();
      };
      updateRequest.onerror = (event) => {
        console.error("Error adding messages to chat:", event.target.error);
        reject(
          new Error("Failed to add messages: " + event.target.error.message)
        );
      };
    };

    getRequest.onerror = (event) => {
      console.error("Error fetching chat:", event.target.error);
      reject(new Error("Failed to fetch chat: " + event.target.error.message));
    };
  });
}

/**
 * Updates a chat in the "chats" object store.
 * @param {string} chatId - The ID of the chat to update.
 * @param {Object} updates - An object containing the fields to update.
 * @returns {Promise} - Resolves if the update is successful, rejects with an error otherwise.
 */
async function updateChat(chatId, updates) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");

    // Check if the chat exists
    const getRequest = store.get(chatId);

    getRequest.onsuccess = (event) => {
      const chat = event.target.result;

      if (!chat) {
        // Chat does not exist
        reject(new Error(`Chat with ID ${chatId} does not exist`));
        return;
      }

      // Merge the updates into the existing chat
      const updatedChat = {
        ...chat,
        ...updates,
        updated_at: new Date(),
      };

      // Update the chat in the store
      const updateRequest = store.put(updatedChat);

      updateRequest.onsuccess = () => {
        console.log(`Chat with ID ${chatId} updated successfully`);
        resolve();
      };

      updateRequest.onerror = (event) => {
        console.error("Error updating chat:", event.target.error);
        reject(
          new Error("Failed to update chat: " + event.target.error.message)
        );
      };
    };

    getRequest.onerror = (event) => {
      console.error("Error fetching chat:", event.target.error);
      reject(new Error("Failed to fetch chat: " + event.target.error.message));
    };
  });
}

/**
 * Get all messages for a chat.
 * @param {string} chatId
 * @returns {Promise<Array>} Resolves with an array of messages
 */
async function getMessagesForChat(chatId) {
  const { db } = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readonly");
    const store = transaction.objectStore("chats");
    const getRequest = store.get(chatId);

    getRequest.onsuccess = (event) => {
      const chat = event.target.result;
      if (!chat || !Array.isArray(chat.messages)) return resolve([]);
      resolve(chat.messages);
    };
    getRequest.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all chats.
 * @returns {Promise<Array>} Resolves with an array of chats
 */
async function getAllChats() {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readonly");
    const store = transaction.objectStore("chats");
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error("Failed to fetch chats: " + event.target.error.message));
    };
  });
}

/**
 * Wipes all data from the "chats" object store.
 * @returns {Promise<void>}
 */
async function clearChats() {
  console.log("Clearing all chats from IndexedDB...");
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");
    const request = store.clear();

    request.onsuccess = () => {
      console.log("All chats cleared from IndexedDB.");
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error clearing chats:", event.target.error);
      reject(new Error("Failed to clear chats: " + event.target.error.message));
    };
  });
}

/**
 * Bulk adds an array of chat objects to the "chats" object store.
 * @param {Array<Object>} chats - Array of chat objects to add.
 * @returns {Promise<void>}
 */
async function bulkAddChats(chats) {
  if (!Array.isArray(chats)) throw new Error("Input must be an array of chats");
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");

    let completed = 0;
    let hasError = false;

    if (chats.length === 0) return resolve();

    chats.forEach((chat) => {
      // If no id, generate one
      if (!chat.id) chat.id = crypto.randomUUID();
      chat.title = chat.title || "Untitled";
      chat.page_url = chat.page_url || "";
      chat.created_at = chat.created_at || new Date();
      chat.updated_at = chat.updated_at || new Date();

      const request = store.add(chat);

      request.onsuccess = () => {
        completed++;
        if (completed === chats.length && !hasError) {
          console.log("Bulk add chats completed.");
          resolve();
        }
      };

      request.onerror = (event) => {
        if (!hasError) {
          hasError = true;
          console.error("Error bulk adding chats:", event.target.error);
          reject(
            new Error("Failed to bulk add chats: " + event.target.error.message)
          );
        }
      };
    });
  });
}

// Add to the exported handler
const idbHandler = {
  openIndexedDB,
  addChat,
  addMessage,
  addMessagesToChat,
  updateChat,
  getMessagesForChat,
  getAllChats,
  clearChats,
  bulkAddChats,
};

export default idbHandler;
