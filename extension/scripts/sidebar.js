import {
  loadSidebarWidth,
  getApiKey,
  getConfig,
  getLanguage,
  clearUserSession,
  getAnonSession,
  state,
  getVisitorId,
  setVisitorId,
} from "./components/state.js";
import {
  renderToggleAccountPopupUI,
  setupEventListeners,
  showPopupDialog,
} from "./components/event-handler.js";
import {
  requestPageContent,
  setupContentExtractionReliability,
} from "./components/content-handler.js";
import { processUserQuery } from "./components/api-handler.js";
import { initializeLanguage } from "./components/i18n.js";
import { isUserAuthenticated } from "./components/auth-handler.js";
import { getFingerprint, setupAnonSession } from "./components/anon-handler.js";
import { injectChatHistoryElements } from "./components/ui-handler.js";

// main app initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("CocBot: Ready to rock");

  // If user is authenticated but session invalid
  isUserAuthenticated()
    .then(({ isAuth, isValid }) => {
      if (isAuth && !isValid) {
        console.log("User session is invalid, signing out user");
        clearUserSession();
        showPopupDialog({
          title: "Session Expired",
          message:
            "Your session has expired and we have signed you out for security reasons",
        });
      }

      // Render UI on first load based on user authentication state
      renderToggleAccountPopupUI(isAuth);
      injectChatHistoryElements(isAuth);
    })
    .catch((err) => {
      console.error("CocBot: Error validating user session", err);
      console.log("Forcing user to sign out");
      clearUserSession();
    });

  // Get user fingerprint
  getVisitorId().then((visitorId) => {
    if (!visitorId) {
      console.log("CocBot: No visitorId found, generating a new one");
      getFingerprint().then((fp) => {
        setVisitorId(fp);
      });
    }
  });

  // Set up anonymous session if not exists
  getAnonSession().then((anonSession) => {
    if (!anonSession) {
      console.log(
        "CocBot: No anon session found, requesting new session from server"
      );
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
