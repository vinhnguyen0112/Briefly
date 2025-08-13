const DB_NAME = "briefly_db";
const DB_VERSION = 1;

/**
 * Opens the IndexedDB and sets up object stores.
 * @returns {Promise<Object>} Database instance
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
      // console.log(`IndexedDB '${DB_NAME}' opened successfully`);
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
 * Upsert (Insert, update if exists) a chat to IndexedDB
 * @param {Object} chat Chat object
 * @param {String} chat.id
 * @param {String} chat.title
 * @param {String} chat.page_url
 * @param {Date} [chat.created_at]
 * @param {Date} [chat.updated_at]
 * @returns {Promise<String>} Inserted chat's ID
 */
async function upsertChat(chat) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");

    if (!chat.id) {
      reject(new Error("Chat id is required"));
      return;
    }
    chat.title = chat.title || "Untitled";
    chat.page_url = chat.page_url || "";
    chat.created_at = chat.created_at || new Date();
    chat.updated_at = chat.updated_at || new Date();

    const request = store.put(chat); // Upsert

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
 * Get a chat by ID
 * @param {string} id Chat ID
 * @returns {Promise<Object>}
 */
async function getChatById(id) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readonly");
    const store = transaction.objectStore("chats");
    const getRequest = store.get(id);

    getRequest.onsuccess = (event) => {
      const chat = event.target.result;
      resolve(chat);
    };

    getRequest.onerror = (event) => {
      reject(
        new Error(
          "Failed to check chat existence: " + event.target.error.message
        )
      );
    };
  });
}

/**
 * Add a single message to a chat in IndexedDB
 * @param {String} chatId Chat ID
 * @param {Object} message Message object to insert
 * @returns {Promise<void>}
 */
async function addMessageToChat(chatId, message) {
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
 * Overwrite the chat's messages with input messages
 * @param {string} chatId Chat ID
 * @param {Array<Object>} messages Array of messages
 * @returns {Promise<void>}
 */
async function overwriteChatMessages(chatId, messages) {
  console.log("Overwriting messages for: ", chatId);
  const { db } = await openIndexedDB();

  return new Promise((resolve, reject) => {
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

      // Overwrite messages
      chat.messages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        model: msg.model,
        created_at: msg.created_at,
      }));

      chat.updated_at = new Date();

      const updateRequest = store.put(chat);
      updateRequest.onsuccess = () => {
        resolve();
      };
      updateRequest.onerror = (event) => {
        console.error("Error overwriting messages:", event.target.error);
        reject(
          new Error(
            "Failed to overwrite messages: " + event.target.error.message
          )
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
 * Update a chat in IndexedDB
 * @param {string} chatId Chat ID
 * @param {Object} updates Update values
 * @returns {Promise}
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
        resolve();
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
 * Deletes a chat by ID from IndexedDB
 * @param {string} id Chat ID
 * @returns {Promise<void>}
 */
async function deleteChatById(id) {
  const { db } = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction("chats", "readwrite");
    const store = transaction.objectStore("chats");
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Chat with ID ${id} deleted from IndexedDB.`);
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error deleting chat:", event.target.error);
      reject(new Error("Failed to delete chat: " + event.target.error.message));
    };
  });
}

/**
 * Get all messages for a chat.
 * @param {string} chatId
 * @returns {Promise<Array>} Array of messages
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
 * Get all chats from IndexedDB
 * @returns {Promise<Array>} Array of chats
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
 * Clear all chats from IndexedDB
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

// Add to the exported handler
const idbHandler = {
  openIndexedDB,
  upsertChat,
  getChatById,
  addMessageToChat,
  overwriteChatMessages,
  updateChat,
  deleteChatById,
  getMessagesForChat,
  clearChats,
};

export default idbHandler;
