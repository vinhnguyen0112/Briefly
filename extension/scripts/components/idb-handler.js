const DB_NAME = "briefly_db";
const DB_VERSION = 1;

// Open IndexedDB
export function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log("IndexedDB upgrade needed, setting up object stores");

      // Create "conversations" object store if needed
      if (!db.objectStoreNames.contains("conversations")) {
        const conversationsStore = db.createObjectStore("conversations", {
          keyPath: "id", // Primary key
          autoIncrement: true,
        });

        // Define indexes
        conversationsStore.createIndex("title", "title", { unique: false });
        conversationsStore.createIndex("page_url", "page_url", {
          unique: false,
        });
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
          autoIncrement: true,
        });

        // Define indexes for "queries"
        queriesStore.createIndex("conversation_id", "conversation_id", {
          unique: false,
        });
        queriesStore.createIndex("query", "query", { unique: false });
        queriesStore.createIndex("response", "response", { unique: false });
        queriesStore.createIndex("model", "model", { unique: false });
        queriesStore.createIndex("created_at", "created_at", { unique: false });
      }

      console.log("Object stores created successfully");
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log(`IndexedDB '${DB_NAME}' opened successfully`);
      resolve({ success: true, db });
    };

    request.onerror = (event) => {
      console.error("Error opening IndexedDB:", event.target.error);
      reject(new Error("Database setup failed: " + event.target.error.message));
    };
  });
}
