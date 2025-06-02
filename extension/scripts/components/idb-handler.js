const DB_NAME = "briefly_db";
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database and sets up object stores if needed.
 * @returns {Promise} A promise that resolves with the database instance
 **/
export function openIndexedDB() {
  return new Promise((resolve, reject) => {
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

  // Create "messages" object store if needed
  if (!db.objectStoreNames.contains("messages")) {
    const messagesStore = db.createObjectStore("messages", {
      keyPath: "id", // Primary key
      autoIncrement: true,
    });

    // Define indexes for "messages"
    messagesStore.createIndex("chat_id", "chat_id", { unique: false });
    messagesStore.createIndex("role", "role", { unique: false });
    messagesStore.createIndex("content", "content", { unique: false });
    messagesStore.createIndex("created_at", "created_at", { unique: false });
  }

  console.log("Object stores created successfully");
}

/**
 * Adds a new chat to the "chats" object store.
 * @param {Object} chat - The chat object to store.
 * @returns {Promise<string>} - Resolves with the ID of the new chat.
 */
export function addChat(chat) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
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

        request.onsuccess = (event) => {
          console.log("Chat added with ID:", chat.id);
          resolve(chat.id);
        };

        request.onerror = (event) => {
          console.error("Error adding chat:", event.target.error);
          reject(
            new Error("Failed to add chat: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Adds a new message to the "messages" object store.
 * @param {Object} message - The message object to store.
 * @returns {Promise<number>} - Resolves with the ID of the new message.
 */
export function addMessage(message) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("messages", "readwrite");
        const store = transaction.objectStore("messages");

        message.created_at = message.created_at || new Date();

        const request = store.add(message);

        request.onsuccess = (event) => {
          console.log("Message added with ID:", event.target.result);
          resolve(event.target.result); // Return the ID of the new message
        };

        request.onerror = (event) => {
          console.error("Error adding message:", event.target.error);
          reject(
            new Error("Failed to add message: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Updates a chat in the "chats" object store.
 * @param {string} chatId - The ID of the chat to update.
 * @param {Object} updates - An object containing the fields to update.
 * @returns {Promise} - Resolves if the update is successful, rejects with an error otherwise.
 */
export function updateChat(chatId, updates) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
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
          reject(
            new Error("Failed to fetch chat: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Get all messages for a chat.
 * @param {string} chatId
 * @returns {Promise<Array>} Resolves with an array of messages
 */
export function getMessagesForChat(chatId) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("messages", "readonly");
        const store = transaction.objectStore("messages");
        const index = store.index("chat_id");
        const request = index.getAll(IDBKeyRange.only(chatId));

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          reject(
            new Error("Failed to fetch messages: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Get all chats.
 * @returns {Promise<Array>} Resolves with an array of chats
 */
export function getAllChats() {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("chats", "readonly");
        const store = transaction.objectStore("chats");
        const request = store.getAll();

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          reject(
            new Error("Failed to fetch chats: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}
