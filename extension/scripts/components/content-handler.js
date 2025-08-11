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
import { formatPdfDate } from "./pdf-handler.js";

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
    ".page-context-indicator"
  );
  if (existingIndicator) existingIndicator.remove();

  const indicator = buildPageContextIndicator();

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
function buildPageContextIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "page-context-indicator context-indicator";

  const context = state.isUsingChatContext
    ? state.chatContext
    : state.pageContent;

  if (!context || context.extractionSuccess === false) {
    indicator.innerHTML = `
      <span class="loading-dots">
        Reading page context <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </span>
    `;
    return indicator;
  }

  if (context.error) {
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
  favicon.className = "page-context-favicon";

  const title = document.createElement("span");
  title.className = "page-context-title";
  title.textContent = pageTitle;

  indicator.appendChild(favicon);
  indicator.appendChild(title);

  if (!state.isUsingChatContext) {
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "page-context-refresh-btn";
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
  } else {
    // Info icon
    const infoIcon = document.createElement("span");
    infoIcon.className = "page-context-info-icon";
    infoIcon.innerHTML = `
      <svg class="w-5 h-5 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
        <line x1="12" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    infoIcon.setAttribute("data-i18n-title", "chatContinuedWithPageContext");

    translateElement(infoIcon);
    indicator.appendChild(infoIcon);
  }

  return indicator;
}

/**
 * Creates or updates the PDF status indicator under the page content indicator.
 * @param {Object} status
 * @param {'loading' | 'reading' | 'done' | 'error'} status.status - Current extraction status.
 * @param {number} [status.page] - Current page processed.
 * @param {number} [status.totalPages] - Total pages.
 * @param {object} [status.metadata] - Optional PDF metadata to show when done.
 */
export function updatePdfStatus() {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  const existingIndicator = chatContainer.querySelector(
    ".pdf-context-indicator"
  );
  if (existingIndicator) existingIndicator.remove();

  const indicator = buildPdfContextIndicator();

  const pageContextIndicator = chatContainer.querySelector(
    ".page-context-indicator"
  );
  if (pageContextIndicator) {
    pageContextIndicator.after(indicator);
  } else {
    chatContainer.prepend(indicator);
  }
}

function buildPdfContextIndicator() {
  const pdfSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="#e2231a" width="16" height="16">
      <path d="M208 48L96 48c-8.8 0-16 7.2-16 16l0 384c0 8.8 7.2 16 16 16l80 0 0 48-80 0c-35.3 0-64-28.7-64-64L32 64C32 28.7 60.7 0 96 0L229.5 0c17 0 33.3 6.7 45.3 18.7L397.3 141.3c12 12 18.7 28.3 18.7 45.3l0 149.5-48 0 0-128-88 0c-39.8 0-72-32.2-72-72l0-88zM348.1 160L256 67.9 256 136c0 13.3 10.7 24 24 24l68.1 0zM240 380l32 0c33.1 0 60 26.9 60 60s-26.9 60-60 60l-12 0 0 28c0 11-9 20-20 20s-20-9-20-20l0-128c0-11 9-20 20-20zm32 80c11 0 20-9 20-20s-9-20-20-20l-12 0 0 40 12 0zm96-80l32 0c28.7 0 52 23.3 52 52l0 64c0 28.7-23.3 52-52 52l-32 0c-11 0-20-9-20-20l0-128c0-11 9-20 20-20zm32 128c6.6 0 12-5.4 12-12l0-64c0-6.6-5.4-12-12-12l-12 0 0 88 12 0zm76-108c0-11 9-20 20-20l48 0c11 0 20 9 20 20s-9 20-20 20l-28 0 0 24 28 0c11 0 20 9 20 20s-9 20-20 20l-28 0 0 44c0 11-9 20-20 20s-20-9-20-20l0-128z"/>
    </svg>`;

  const indicator = document.createElement("div");
  indicator.className = "pdf-context-indicator context-indicator";

  const {
    status,
    page = 0,
    totalPages = 0,
    metadata = {},
  } = state.pdfContent || {};

  switch (status) {
    case "loading":
      indicator.innerHTML = `
        <div class="context-indicator-content loading">
          ${pdfSvg}
          <span class="loading-dots">Loading PDF<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
        </div>
      `;
      break;

    case "reading":
      indicator.innerHTML = `
        <div class="context-indicator-content reading">
          ${pdfSvg}
          <span class="loading-dots">Reading PDF<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
          <span class="page-counter">Page ${page} of ${totalPages}</span>
        </div>
      `;

      // Info icon
      const infoIcon = document.createElement("span");
      infoIcon.className = "context-info-icon";
      infoIcon.innerHTML = `
        <svg class="w-5 h-5 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
          <line x1="12" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      infoIcon.setAttribute("data-i18n-title", "pdfReadingContextInfo");

      translateElement(infoIcon);
      indicator.appendChild(infoIcon);
      break;

    case "success":
      const title = metadata.title || "Unknown Title";
      const author = metadata.author || "Unknown Author";
      const date =
        formatPdfDate(
          metadata.creationDate || metadata.modificationDate,
          true
        ) || "Unknown Date";

      indicator.innerHTML = `
        <div class="context-indicator-content success">
          ${pdfSvg}
          <span><strong>${title}</strong> by <em>${author}</em> (${date})</span>
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

  return indicator;
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
    updatePdfStatus();

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
