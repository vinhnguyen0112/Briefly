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

  // Create "conversations" object store if needed
  if (!db.objectStoreNames.contains("conversations")) {
    const conversationsStore = db.createObjectStore("conversations", {
      keyPath: "id", // Primary key
    });

    // Define indexes
    conversationsStore.createIndex("title", "title", { unique: false });
    conversationsStore.createIndex("page_url", "page_url", { unique: false });
    conversationsStore.createIndex("created_at", "created_at", {
      unique: false,
    });
    conversationsStore.createIndex("updated_at", "updated_at", {
      unique: false,
    });
  }

  // Create "queries" object store if needed
  if (!db.objectStoreNames.contains("queries")) {
    const queriesStore = db.createObjectStore("queries", {
      keyPath: "id", // Primary key
    });

    // Define indexes for "queries"
    queriesStore.createIndex("conversation_id", "conversation_id", {
      unique: false,
    });
    queriesStore.createIndex("created_at", "created_at", { unique: false });
  }

  console.log("Object stores created successfully");
}

/**
 * Adds a new conversation to the "conversations" object store.
 * @param {Object} conversation - The conversation object to store.
 * @returns {Promise<number>} - Resolves with the ID of the new conversation.
 */
export function addConversation(conversation) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("conversations", "readwrite");
        const store = transaction.objectStore("conversations");

        const request = store.add({
          title: conversation.title,
          page_url: conversation.page_url,
          created_at: new Date(),
          updated_at: new Date(),
        });

        request.onsuccess = (event) => {
          console.log("Conversation added with ID:", event.target.result);
          resolve(event.target.result); // Return the ID of the new conversation
        };

        request.onerror = (event) => {
          console.error("Error adding conversation:", event.target.error);
          reject(
            new Error(
              "Failed to add conversation: " + event.target.error.message
            )
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Adds a new query to the "queries" object store.
 * @param {Object} query - The query object to store.
 * @returns {Promise<number>} - Resolves with the ID of the new query.
 */
export function addQuery(query) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("queries", "readwrite");
        const store = transaction.objectStore("queries");

        const request = store.add({
          conversation_id: query.conversation_id,
          query: query.query,
          response: query.response,
          model: query.model,
          created_at: new Date(),
        });

        request.onsuccess = (event) => {
          console.log("Query added with ID:", event.target.result);
          resolve(event.target.result); // Return the ID of the new query
        };

        request.onerror = (event) => {
          console.error("Error adding query:", event.target.error);
          reject(
            new Error("Failed to add query: " + event.target.error.message)
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Updates a conversation in the "conversations" object store.
 * @param {number} conversationId - The ID of the conversation to update.
 * @param {Object} updates - An object containing the fields to update.
 * @returns {Promise} - Resolves if the update is successful, rejects with an error otherwise.
 */
export function updateConversation(conversationId, updates) {
  return new Promise((resolve, reject) => {
    openIndexedDB()
      .then(({ db }) => {
        const transaction = db.transaction("conversations", "readwrite");
        const store = transaction.objectStore("conversations");

        // Check if the conversation exists
        const getRequest = store.get(conversationId);

        getRequest.onsuccess = (event) => {
          const conversation = event.target.result;

          if (!conversation) {
            // Conversation does not exist
            reject(
              new Error(`Conversation with ID ${conversationId} does not exist`)
            );
            return;
          }

          // Merge the updates into the existing conversation
          const updatedConversation = {
            ...conversation,
            ...updates,
          };

          // Update the conversation in the store
          const updateRequest = store.put(updatedConversation);

          updateRequest.onsuccess = () => {
            console.log(
              `Conversation with ID ${conversationId} updated successfully`
            );
            resolve();
          };

          updateRequest.onerror = (event) => {
            console.error("Error updating conversation:", event.target.error);
            reject(
              new Error(
                "Failed to update conversation: " + event.target.error.message
              )
            );
          };
        };

        getRequest.onerror = (event) => {
          console.error("Error fetching conversation:", event.target.error);
          reject(
            new Error(
              "Failed to fetch conversation: " + event.target.error.message
            )
          );
        };
      })
      .catch((error) => {
        reject(error);
      });
  });
}
