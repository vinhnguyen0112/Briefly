// handles page content extraction and rendering
import { elements } from "./dom-elements.js";
import { state } from "./state.js";
import { switchToChat } from "./ui-handler.js";
import {
  generateQuestionsFromContent,
  processUserQuery,
} from "./api-handler.js";

// request page content from background script
export function requestPageContent() {
  console.log("CocBot: Requesting page content");

  // reset questions
  // state.generatedQuestions = null;
  // const questionsContainer = document.querySelector(".generated-questions");
  // if (questionsContainer) {
  //   questionsContainer.style.display = "none";
  // }

  // track attempts
  state.contentFetchAttempts++;

  // Clear the previous content to force a fresh extraction
  state.pageContent = null;

  chrome.runtime.sendMessage(
    { action: "extract_page_content", forceRefresh: true },
    (response) => {
      if (!response) {
        console.error("CocBot: No response from background script");
        return;
      }

      if (response && response.success) {
        console.log("CocBot: Got page content!");
        state.pageContent = response.content;

        // update ui
        updateContentStatus();

        // reset counter on success
        state.contentFetchAttempts = 0;
      } else {
        console.log(
          "CocBot: Content extraction failed:",
          response?.error || "Unknown error"
        );

        // If we have a partial content result, still use it
        if (response.content && response.content.title) {
          console.log("CocBot: Using partial content result");
          state.pageContent = response.content;
          state.pageContent.extractionSuccess = false;
          updateContentStatus();
        }

        // retry up to max attempts
        if (state.contentFetchAttempts < state.maxContentFetchAttempts) {
          console.log(
            `CocBot: Will retry in 2 seconds (attempt ${state.contentFetchAttempts} of ${state.maxContentFetchAttempts})`
          );
          setTimeout(() => {
            requestPageContent();
          }, 2000);
        } else {
          console.error(
            "CocBot: Max content fetch attempts reached, giving up"
          );
        }
      }
    }
  );
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

// update page context in welcome screen
export function updateContentStatus() {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  // Remove existing indicator
  const existingIndicator = chatContainer.querySelector(
    ".chat-context-indicator"
  );
  if (existingIndicator) existingIndicator.remove();

  const indicator = document.createElement("div");
  indicator.className = "chat-context-indicator";

  if (!state.pageContent) {
    indicator.textContent = "Loading page context...";
    chatContainer.prepend(indicator);
    return;
  }

  if (state.pageContent.extractionSuccess === false) {
    indicator.innerHTML = `⚠️ Limited page context available`;
    chatContainer.prepend(indicator);
    return;
  }

  const pageTitle = state.pageContent.title || "Untitled Page";
  const domain = (() => {
    try {
      const url = new URL(state.pageContent.url || window.location.href);
      return url.hostname;
    } catch {
      return "";
    }
  })();

  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

  // Favicon
  const favicon = document.createElement("img");
  favicon.src = faviconUrl;
  favicon.alt = "Page icon";
  favicon.className = "chat-context-favicon";

  // Title
  const title = document.createElement("span");
  title.className = "chat-context-title";
  title.textContent = pageTitle;

  // Refresh button
  const refreshBtn = document.createElement("button");
  refreshBtn.className = "chat-context-refresh-btn";
  refreshBtn.innerHTML = `\
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"/>
    </svg>
  `;
  refreshBtn.title = "Refresh page context";

  refreshBtn.addEventListener("click", async () => {
    requestPageContent();
  });

  indicator.appendChild(favicon);
  indicator.appendChild(title);
  indicator.appendChild(refreshBtn);

  chatContainer.prepend(indicator);
}

// generate and display questions about the content
export async function generateAndDisplayQuestions() {
  // check if we already have questions
  if (
    state.generatedQuestions ||
    state.isGeneratingQuestions ||
    !state.pageContent
  ) {
    return;
  }

  // get reference to questions container
  const questionsContainer = document.querySelector(".generated-questions");
  const buttonContainer = document.querySelector(".question-buttons-container");

  // check if we have the elements
  if (!questionsContainer || !buttonContainer) {
    console.error("CocBot: Missing question container elements");
    return;
  }

  // show the container with loading state
  questionsContainer.style.display = "block";

  // set flag to prevent multiple calls
  state.isGeneratingQuestions = true;

  try {
    // generate questions
    const result = await generateQuestionsFromContent(state.pageContent);

    console.log("Generated questions result: ", result);

    // clear the loading indicator
    buttonContainer.innerHTML = "";

    if (result.success && result.questions && result.questions.length > 0) {
      console.log("CocBot: Successfully generated questions", result.questions);

      // save the questions
      state.generatedQuestions = result.questions;

      // add each question as a button
      result.questions.forEach((question) => {
        const questionButton = document.createElement("button");
        questionButton.className = "question-button";
        questionButton.textContent = question;
        questionButton.onclick = () => {
          processUserQuery(question);
        };

        buttonContainer.appendChild(questionButton);
      });
    } else {
      console.error("CocBot: Failed to generate questions", result.error);
      questionsContainer.style.display = "none";
    }
  } catch (error) {
    console.error("CocBot: Error in generating questions", error);
    questionsContainer.style.display = "none";
  } finally {
    state.isGeneratingQuestions = false;
  }
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
