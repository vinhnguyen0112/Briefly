// handles page content extraction and rendering
import { elements } from "./dom-elements.js";
import { state } from "./state.js";
import {
  resetSuggestedQuestionsContainer,
  switchToChat,
} from "./ui-handler.js";
import {
  generateQuestionsFromContent,
  processUserQuery,
} from "./api-handler.js";
import { translateElement } from "./i18n.js";

/**
 * Extracts page content by messaging the background script.
 * Retries on failure up to `state.maxContentFetchAttempts`.
 *
 * @returns {Promise<Object>} Resolves with content (full or partial), or rejects on failure.
 */
export function requestPageContent() {
  return new Promise((resolve, reject) => {
    console.log("CocBot: Requesting page content");

    // Increment the retry attempt counter
    state.contentFetchAttempts++;

    // Clear any previous content to force fresh extraction
    state.pageContent = null;

    // Internal function that performs the actual extraction logic (with retry support)
    function tryFetch() {
      chrome.runtime.sendMessage(
        { action: "extract_page_content", forceRefresh: true },
        (response) => {
          // No response from background script
          if (!response) {
            console.error("CocBot: No response from background script");
            return reject("No response from background script");
          }

          // Content extraction successful
          if (response.success) {
            console.log("CocBot: Got page content!");
            state.pageContent = response.content; // Assign new page content

            // Update UI and reset retry counter
            updateContentStatus();
            state.contentFetchAttempts = 0;

            return resolve(response.content);
          }

          // If there's partial content (e.g., a title), use it anyway
          if (response.content && response.content.title) {
            console.log("CocBot: Using partial content result");
            state.pageContent = {
              ...response.content,
              extractionSuccess: false,
            };

            updateContentStatus();
            return resolve(state.pageContent);
          }

          // Retry logic: check if more attempts are allowed
          if (state.contentFetchAttempts < state.maxContentFetchAttempts) {
            console.warn(
              `CocBot: Will retry in 2 seconds (attempt ${state.contentFetchAttempts} of ${state.maxContentFetchAttempts})`
            );

            setTimeout(tryFetch, 2000);
          } else {
            // Exhausted all retry attempts
            console.error(
              "CocBot: Max content fetch attempts reached, giving up"
            );
            return reject("Max content fetch attempts reached");
          }
        }
      );
    }

    // Start the first attempt
    tryFetch();
  });
}

// display content in sidebar
export function renderContentInSidebar(content) {
  if (!content) {
    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-ui-error">
        <p>No content found. Try refreshing.</p>
      </div>
    `;
    return;
  }

  try {
    // format using contentviewer
    const structured = window.ContentViewer.formatExtractedContent(content);
    const html = window.ContentViewer.generateContentViewerHTML(structured);

    // show it
    elements.contentDisplay.innerHTML = html;

    // wire up interactions
    window.ContentViewer.attachContentViewerEvents(elements.contentDisplay);
  } catch (error) {
    console.error("CocBot: Error showing content", error);
    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-ui-error">
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Updates the chat container with a context indicator that shows
 * the current page's title and favicon. If `.welcome-container`
 * exists, the indicator is inserted after it; otherwise, it is
 * prepended to `#chat-container`.
 */
export function updateContentStatus() {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  // Remove any existing indicator
  const existingIndicator = chatContainer.querySelector(
    ".chat-context-indicator"
  );
  if (existingIndicator) existingIndicator.remove();

  const indicator = buildContextIndicator();

  // Insert after welcome section
  const welcomeSection = chatContainer.querySelector(".welcome-container");
  if (welcomeSection) {
    welcomeSection.after(indicator);
  } else {
    chatContainer.prepend(indicator);
  }
}

/**
 * Creates the context indicator element based on the current page content.
 * Includes a favicon, page title, and a refresh button to reload context.
 * @returns {HTMLDivElement} The DOM element representing the context indicator.
 */
function buildContextIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "chat-context-indicator";

  const context = state.isViewingChatHistory
    ? state.chatContext
    : state.pageContent;

  if (!context) {
    indicator.textContent = "Loading page context...";
    return indicator;
  }

  if (context.extractionSuccess === false) {
    indicator.innerHTML = `⚠️ Limited page context available`;
    return indicator;
  }

  const pageTitle = context.title;
  const rawUrl = context.url;

  let domain = "";
  try {
    domain = new URL(rawUrl).hostname;
  } catch {
    domain = "";
  }

  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

  const favicon = document.createElement("img");
  favicon.src = faviconUrl;
  favicon.alt = "Page icon";
  favicon.className = "chat-context-favicon";

  const title = document.createElement("span");
  title.className = "chat-context-title";
  title.textContent = pageTitle;

  indicator.appendChild(favicon);
  indicator.appendChild(title);

  if (!state.isViewingChatHistory) {
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "chat-context-refresh-btn";
    refreshBtn.dataset.i18nTitle = "refreshPageContext";
    refreshBtn.title = "Refresh Page Context";
    refreshBtn.innerHTML = `
      <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"/>
      </svg>
    `;
    refreshBtn.addEventListener("click", () => {
      requestPageContent().then(() => {
        resetSuggestedQuestionsContainer();
        state.generatedQuestions = {};
      });
    });
    translateElement(refreshBtn);
    indicator.appendChild(refreshBtn);
  }

  return indicator;
}

// setup improved content extraction reliability
export function setupContentExtractionReliability() {
  // listen for page changes and refresh content accordingly
  setInterval(() => {
    // Check if we don't have content or if extraction was unsuccessful
    const needsContentRefresh =
      !state.pageContent ||
      (state.pageContent && state.pageContent.extractionSuccess === false);

    if (document.visibilityState === "visible" && needsContentRefresh) {
      console.log(
        "CocBot: Tab is visible and content needs refresh, retrying extraction"
      );
      state.contentFetchAttempts = 0; // reset counter
      requestPageContent();
    }
  }, 5000);

  // Also attempt content extraction when the tab becomes visible
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Only request content if we don't have it or if extraction previously failed
      const needsContentRefresh =
        !state.pageContent ||
        (state.pageContent && state.pageContent.extractionSuccess === false);

      if (needsContentRefresh) {
        console.log("CocBot: Tab became visible and content needs refresh");
        state.contentFetchAttempts = 0;
        requestPageContent();
      }
    }
  });

  // Add a debug button in dev mode
  if (
    location.hostname === "localhost" ||
    location.search.includes("debug=true")
  ) {
    const debugButton = document.createElement("button");
    debugButton.textContent = "Debug Content";
    debugButton.style.position = "absolute";
    debugButton.style.bottom = "10px";
    debugButton.style.right = "10px";
    debugButton.style.zIndex = "9999";
    debugButton.onclick = () => {
      state.contentFetchAttempts = 0;
      requestPageContent();
      alert(
        "Content debug: " +
          (state.pageContent ? "Content available" : "No content")
      );
      console.log("Content debug:", state.pageContent);
    };
    document.body.appendChild(debugButton);
  }
}
