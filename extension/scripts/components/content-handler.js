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

  const existingIndicator = chatContainer.querySelector(
    ".chat-context-indicator"
  );
  if (existingIndicator) existingIndicator.remove();

  const indicator = buildContextIndicator();

  const welcomeSection = chatContainer.querySelector(".welcome-container");
  if (welcomeSection) {
    welcomeSection.after(indicator);
  } else {
    chatContainer.prepend(indicator);
  }
}

/**
 * Creates the context indicator element based on the current page content and PDF status.
 * Includes a favicon, page title, and a refresh button to reload context.
 * Shows PDF loading progress if applicable.
 * @returns {HTMLDivElement} The DOM element representing the context indicator.
 */
function buildContextIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-context-indicator";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";

  // --- Main: Page Content Context Section ---
  const pageSection = document.createElement("div");
  pageSection.className = "chat-context-item";
  pageSection.id = "chat-context-page";
  const context = state.isUsingChatContext
    ? state.chatContext
    : state.pageContent;

  if (!context || context.extractionSuccess === false) {
    pageSection.innerHTML = `
      <span class="loading-dots">
        Reading page context <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </span>
    `;
  } else if (context.error) {
    pageSection.innerHTML = `⚠️ Limited page context available`;
  } else {
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

    pageSection.appendChild(favicon);
    pageSection.appendChild(title);

    if (!state.isUsingChatContext) {
      const refreshBtn = document.createElement("button");
      refreshBtn.className = "chat-context-refresh-btn";
      refreshBtn.dataset.i18nTitle = "refreshPageContext";
      refreshBtn.title = "Refresh Page Context";
      refreshBtn.innerHTML = `
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4" />
        </svg>
      `;
      refreshBtn.addEventListener("click", () => {
        requestPageContent().then(() => {
          resetSuggestedQuestionsContainer();
          state.generatedQuestions = {};
        });
      });
      translateElement(refreshBtn);
      pageSection.appendChild(refreshBtn);
    }
  }

  wrapper.appendChild(pageSection);

  return wrapper;
}

/**
 * Creates or updates the PDF status indicator under the page content indicator.
 * @param {Object} status
 * @param {'loading' | 'reading' | 'done' | 'error'} status.status - Current extraction status.
 * @param {number} [status.page] - Current page processed.
 * @param {number} [status.totalPages] - Total pages.
 * @param {object} [status.metadata] - Optional PDF metadata to show when done.
 */
export function updatePdfStatus({ status, page, totalPages, metadata = {} }) {
  let indicator = document.getElementById("chat-context-pdf");

  if (!indicator) {
    const wrapper = document.querySelector(".chat-context-indicator");
    if (!wrapper) return;

    indicator = document.createElement("div");
    indicator.className = "chat-context-item";
    indicator.id = "chat-context-pdf";
    wrapper.appendChild(indicator);
  }

  switch (status) {
    case "loading":
      indicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; gap: 10px;">
          <span class="loading-dots">Loading PDF<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
        </div>
      `;
      break;

    case "reading":
      indicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; gap: 10px;">
          <span class="loading-dots">Reading PDF<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
          <span style="white-space: nowrap;">Page ${page} of ${totalPages}</span>
        </div>
      `;
      break;

    case "success":
      const title = metadata.title || "Unknown Title";
      const author = metadata.author || "Unknown Author";
      const date =
        metadata.creationDate || metadata.modificationDate || "Unknown Date";

      indicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 0.9em; overflow-x: auto;">
          <span><strong>${author}</strong></span>
          <span>${title}</span>
          <span>${date}</span>
        </div>
      `;
      break;

    case "error":
      indicator.innerHTML = `
        <div style="color: red; font-size: 0.9em;">
          Failed to extract PDF content.
        </div>
      `;
      break;

    default:
      indicator.innerHTML = `
        <div style="color: gray; font-size: 0.9em;">
          Unknown PDF status.
        </div>
      `;
      console.log("PDF status unknown:", status);
      break;
  }
}

/**
 * Watches pdfContent and triggers `updateContentStatus()` on progress.
 * You only need to call this ONCE after PDF extraction starts.
 */
export function observePdfContentState() {
  let lastPage = -1;
  const interval = setInterval(() => {
    const pdf = state.pdfContent;
    if (!pdf || pdf.page === lastPage) return;

    lastPage = pdf.page;
    updatePdfStatus({
      status: pdf.status,
      page: pdf.page,
      totalPages: pdf.totalPages,
      metadata: pdf.metadata,
    });

    // Stop observing once done
    if (pdf.page >= pdf.totalPages || pdf.extractionSuccess)
      clearInterval(interval);
  }, 500); // check every 0.5 seconds
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
