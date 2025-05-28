import {
  loadSidebarWidth,
  getApiKey,
  getConfig,
  getLanguage,
} from "./components/state.js";
import { setupEventListeners } from "./components/event-handler.js";
import {
  requestPageContent,
  setupContentExtractionReliability,
} from "./components/content-handler.js";
import { processUserQuery } from "./components/api-handler.js";
import { initializeLanguage } from "./components/i18n.js";

// main app initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("CocBot: Ready to rock");
  // Validate the user session
  isUserAuthenticated()
    .then((isAuthenticated) => {
      if (!isAuthenticated) {
        clearUserSession();
      }
      // Force re-render of account popup UI on load
      // Because StorageArea observer doesn't auto run on reloads
      renderToggleAccountPopupUI(isAuthenticated);
    })
    .catch((err) => {
      console.error("CocBot: Error validating user session", err);
      console.log("Forcing user to sign out");
      clearUserSession();
    });

  // Set up anonymous session if not exists
  getAnonSession().then((anonSession) => {
    if (!anonSession) {
      setupAnonSession();
    }
  });

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
