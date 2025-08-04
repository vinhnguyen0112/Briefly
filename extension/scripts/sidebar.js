import {
  loadSidebarWidth,
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
import {
  clearMessagesFromMessageContainer,
  configureChatHistoryElementsOnAuthState,
  createChatActionsContainer,
  createWelcomeContainer,
} from "./components/ui-handler.js";
import { elements } from "./components/dom-elements.js";
import { extractTextFromPDF } from "./components/pdf-handler.js";

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PDF") {
    console.log("Extracting PDF from:", message.url);

    try {
      const result = await extractTextFromPDF(message.url);

      if (result?.content) {
        const trimmedContent = result.content.split(/\s+/).slice(0, 90000).join(" ").trim();
        
        state.pageContent = state.pageContent || {};
        state.pageContent.pdfContent = {
          url: message.url,
          title: "PDF Document",
          content: trimmedContent,
          extractionSuccess: true,
        };

        
        console.log("PDF content extracted successfully:", result.content);
        console.log("PDF content stored in state.pageContent");
      } else {
        console.warn("PDF extraction returned empty content");
      }
    } catch (err) {
      console.error("Error extracting PDF:", err);
    }
  }
});

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
      configureChatHistoryElementsOnAuthState(isAuth);
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

  initializeStartupUI();
});

// expose certain functions to the global scope that might be needed by inline event handlers
window.processUserQuery = processUserQuery;

function initializeStartupUI() {
  // Make sure message container is empty on startup
  clearMessagesFromMessageContainer();

  // Inject welcome container & chat actions container
  if (!elements.chatContainer.querySelector(".welcome-container")) {
    const welcomeContainer = createWelcomeContainer();
    elements.chatContainer.prepend(welcomeContainer);
  }
  if (!elements.chatContainer.querySelector(".chat-actions-container")) {
    const chatActionsContainer = createChatActionsContainer();
    elements.chatContainer.appendChild(chatActionsContainer);
  }
}
