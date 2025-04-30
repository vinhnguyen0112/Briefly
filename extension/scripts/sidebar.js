import {
  loadSidebarWidth,
  getApiKey,
  getConfig,
  getUserSession,
  clearUserSession,
} from "./components/state.js";
import { setupEventListeners } from "./components/event-handler.js";
import {
  requestPageContent,
  setupContentExtractionReliability,
} from "./components/content-handler.js";
import { processUserQuery } from "./components/api-handler.js";
import {
  isSessionValid,
  isUserAuthenticated,
  setUpAnonQueryCount,
  validateUserSession,
} from "./components/auth-handler.js";

// main app initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("CocBot: Ready to rock");

  // Validate the user session first before anything
  validateUserSession().then(async (isValid) => {
    // Clear session + Update UI if session not valid
    await clearUserSession();
  });

  // check for api key
  getApiKey().then((key) => {
    if (key) {
      document.getElementById("api-key").value = key;
    }
  });

  // Set up anon query count
  setUpAnonQueryCount().then(() => {
    console.log("Anon query count set up.");
  });

  // load config
  getConfig()
    .then((config) => {
      if (config) {
        window.currentConfig = config;
        console.log("CocBot: Got the settings", config);
      } else {
        // Set default config if none exists
        window.currentConfig = {
          personality:
            "Be friendly and concise, and stick to the facts in the content.",
          maxWordCount: 150,
          detailLevel: "medium",
        };
        console.log("CocBot: Using default settings", window.currentConfig);
      }
    })
    .catch((error) => {
      console.error("CocBot: Error loading config", error);
      // Set default config on error
      window.currentConfig = {
        personality:
          "Be friendly and concise, and stick to the facts in the content.",
        maxWordCount: 150,
        detailLevel: "medium",
      };
    });

  // set width from last time
  loadSidebarWidth();

  // set up event listeners
  setupEventListeners();

  // get page content
  requestPageContent();

  // make sure content extraction is reliable
  setupContentExtractionReliability();
});

// expose certain functions to the global scope that might be needed by inline event handlers
window.processUserQuery = processUserQuery;
