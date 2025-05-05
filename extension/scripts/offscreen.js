console.log("Offscreen document loaded.");

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
  // Return early if this message isn't meant for the offscreen document.
  if (message.target !== "offscreen") {
    return;
  }

  // Dispatch the message to an appropriate handler.
  if (message.action === "setup_storage") {
    try {
      const response = await setupIndexedDB("testDB");
      console.log("IndexedDB setup complete:", response);
      sendResponse({ success: true, message: "Database opened successfully" });
    } catch (error) {
      console.error("Error setting up IndexedDB:", error);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep the message channel open for async response
  }
}

function setupIndexedDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);

    request.onsuccess = (event) => {
      console.log(`Database '${dbName}' opened successfully`);
      resolve({ success: true, db: event.target.result });
    };

    request.onerror = (event) => {
      console.error(`Failed to open database '${dbName}':`, event.target.error);
      reject(new Error(event.target.error.message));
    };
  });
}
