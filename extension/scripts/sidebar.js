import {
  loadSidebarWidth,
  getApiKey,
  getConfig,
  getLanguage,
  clearUserSession,
  state,
} from "./components/state.js";
import { setupEventListeners } from "./components/event-handler.js";
import {
  requestPageContent,
  setupContentExtractionReliability,
} from "./components/content-handler.js";
import { processUserQuery } from "./components/api-handler.js";
import { initializeLanguage } from "./components/i18n.js";
import {
  setUpAnonQueryCount,
  validateUserSession,
} from "./components/auth-handler.js";

// main app initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("CocBot: Ready to rock");

  // Validate the user session
  validateUserSession()
    .then((isValid) => {
      // Set authentication state for authentication depedent UI
      state.isAuthenticated = isValid;

      // Clear user session from storage if user is unauthenticated
      if (!isValid) {
        clearUserSession();
      }
    })
    .catch((error) => {
      console.error("CocBot: Error validating user session", error);
      console.log("Force setting user session to unauthenticated");
      state.isAuthenticated = false;
      clearUserSession();
    });

  setUpAnonQueryCount();

  // check for api key
  getApiKey().then((key) => {
    if (key) {
      document.getElementById("api-key").value = key;
    }
  });

  // load language preference first
  getLanguage()
    .then((language) => {
      console.log("CocBot: Language preference:", language);

      state.language = language;

      const languageToggle = document.getElementById("language-toggle");
      if (languageToggle) {
        languageToggle.checked = language === "vi";

        const enLabel = document.getElementById("en-label");
        const viLabel = document.getElementById("vi-label");

        if (enLabel && viLabel) {
          enLabel.classList.toggle("active", language === "en");
          viLabel.classList.toggle("active", language === "vi");
        }
      }

      return initializeLanguage();
    })
    .then(() => {
      console.log("CocBot: Internationalization initialized");
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
