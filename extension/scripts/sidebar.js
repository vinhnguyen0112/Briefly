import {
  loadSidebarWidth,
  getConfig,
  getLanguage,
  clearUserSession,
  getAnonSession,
  state,
  getVisitorId,
  setVisitorId,
  getUserSession,
} from "./components/state.js";
import {
  renderToggleAccountPopupUI,
  setupEventListeners,
  showPopupDialog,
} from "./components/event-handler.js";
import {
  observePdfContentState,
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
        state.currentConfig = config;
        console.log("CocBot: Got the settings", config);
      } else {
        // Set default config if none exists
        state.currentConfig = {
          personality:
            "Be friendly and concise, and stick to the facts in the content.",
          maxWordCount: 150,
          detailLevel: "medium",
        };
        console.log("CocBot: Using default settings", state.currentConfig);
      }
    })
    .catch((error) => {
      console.error("CocBot: Error loading config", error);
      // Set default config on error
      state.currentConfig = {
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
  requestPageContent().then(() => {
    getUserSession().then((session) => {
      if (session && session.id) {
        // Store page metadata if extraction was success
        if (state.pageContent && state.pageContent.extractionSuccess) {
          console.log("Storing page metadata");

          storePageMetadata();
        }
      }
    });
  });

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

// Listen for messages from the background script to extract PDF content
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "extract_pdf") {
    console.log(
      "Sidebar received PDF extraction request for URL:",
      message.url
    );

    // Initialize PDF content state
    state.pdfContent = {
      status: "loading",
    };

    observePdfContentState();

    const result = await extractTextFromPDF(message.url, (partial) => {
      // Continously update pdf status
      state.pdfContent = {
        status: "reading",
        page: partial.page,
        totalPages: partial.totalPages,
        content: partial.content,
        metadata: partial.metadata,
      };
    });

    state.pdfContent.status = result.status;

    // Store pdf content
    const authSession = await getUserSession();
    if (!authSession || !authSession.id) return;
    if (state.pdfContent.status === "success" && state.pdfContent.content) {
      const formattedPdfContent = formatPdfContent(
        state.pdfContent.content,
        state.pdfContent.metadata
      );
      chrome.runtime.sendMessage(
        {
          action: "store_pdf_content",
          pdf_content: formattedPdfContent,
          page_url: state.pageContent.url,
        },
        (response) => {
          // Row not found, re-insert page metadata
          if (response.success && response.data?.affectedRows === 0) {
            console.log("Row not found, re-inserting page metadata");
            storePageMetadata();
          }
        }
      );
    }
  }
});

/**
 * Helper function to pass store_page_metadata message to background script
 */
function storePageMetadata() {
  const pdfContent =
    state.pdfContent?.status === "success"
      ? formatPdfContent(state.pdfContent.content, state.pdfContent.metadata)
      : null;
  chrome.runtime.sendMessage(
    {
      action: "store_page_metadata",
      page_url: state.pageContent.url,
      title: state.pageContent.title,
      page_content: state.pageContent.content,
      pdf_content: pdfContent,
    },
    (response) => {
      // Do sth here if needed
    }
  );
}

if (state.pdfContent.status === "success" && state.pdfContent.content) {
  const formattedPdfContent = formatPdfContent(
    state.pdfContent.content,
    state.pdfContent.metadata
  );
  chrome.runtime.sendMessage(
    {
      action: "store_pdf_content",
      content: formattedPdfContent,
      page_url: state.pageContent.url,
    },
    (response) => {
      // Row not found, re-insert page metadata
      if (response.success && response.data?.affectedRows === 0) {
        console.log("Row not found, re-inserting page metadata");
        storePageMetadata();
      }
    }
  );
}

/**
 * Format the pdf content with metadata prepended
 * @param {String} content - Raw PDF content
 * @param {Object} metadata - PDF metadata object
 * @returns {String} Sanitized PDF content with metadata prepended
 */
function formatPdfContent(content, metadata) {
  if (!content) return null;

  if (!metadata) return content;

  let metadataBlock = "Metadata:\\n";

  if (metadata.title) metadataBlock += `• Title: ${metadata.title}\\n`;
  if (metadata.author) metadataBlock += `• Author: ${metadata.author}\\n`;
  if (metadata.subject) metadataBlock += `• Subject: ${metadata.subject}\\n`;
  if (metadata.keywords) metadataBlock += `• Keywords: ${metadata.keywords}\\n`;
  if (metadata.language) metadataBlock += `• Language: ${metadata.language}\\n`;
  if (metadata.creator) metadataBlock += `• Creator: ${metadata.creator}\\n`;
  if (metadata.producer) metadataBlock += `• Producer: ${metadata.producer}\\n`;
  if (metadata.creationDate)
    metadataBlock += `• Created: ${metadata.creationDate}\\n`;
  if (metadata.modificationDate)
    metadataBlock += `• Modified: ${metadata.modificationDate}\\n`;

  const result = `${metadataBlock}\\n${content}`;

  return result.trim();
}
