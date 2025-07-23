// ui interaction stuff
import { elements } from "./dom-elements.js";
import {
  state,
  saveSidebarWidth,
  getUserSession,
  resetCurrentChatState,
  resetPaginationState,
  sendRequest,
} from "./state.js";
import { requestPageContent, updateContentStatus } from "./content-handler.js";
import {
  renderToggleAccountPopupUI,
  setupListenersForDynamicChatHistoryElements,
  setupQuickActionsEvent,
  showPopupDialog,
  showSignInAlertPopup,
} from "./event-handler.js";
import {
  generateQuestionsFromContent,
  processUserQuery,
} from "./api-handler.js";

/**
 * Close all screens and panels beside chat screen as it's main screen
 */
export function closeAllScreensAndPanels() {
  // hide config
  elements.configContainer.style.display = "none";
  elements.configButton.classList.remove("active");
  state.isConfigOpen = false;

  // hide notes
  elements.notesScreen.style.display = "none";
  elements.notesButton.classList.remove("active");
  state.isNotesOpen = false;

  // hide sign in alert
  elements.signInAlertOverlay.style.display = "none";

  // hide account popup
  elements.accountPopup.style.display = "none";

  // hide chat history screen
  elements.chatHistoryScreen.style.display = "none";
  document.getElementById("chat-history-button").classList.remove("active");

  // show main screen
  elements.chatScreen.style.display = "flex";
}

// handle resize events
export function handleResize(e) {
  if (!state.isResizing) return;

  // figure out new width
  const sidebarRect = elements.sidebar.getBoundingClientRect();
  const newWidth = window.innerWidth - e.clientX;

  // keep it in bounds
  const minWidth = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--sidebar-min-width"
    )
  );
  const maxWidth = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--sidebar-max-width"
    )
  );

  const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

  // update width
  document.documentElement.style.setProperty(
    "--sidebar-width",
    constrainedWidth + "px"
  );

  // tell parent to resize too
  window.parent.postMessage(
    {
      action: "sidebar_width_changed",
      width: constrainedWidth,
    },
    "*"
  );
}

// done resizing
export function stopResize() {
  if (state.isResizing) {
    state.isResizing = false;
    elements.resizeHandle.classList.remove("active");
    document.body.classList.remove("sidebar-resizing");
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);

    // save the width
    const currentWidth = getComputedStyle(elements.sidebar).width;
    const widthValue = parseInt(currentWidth);
    saveSidebarWidth(widthValue);

    // tell parent about final size
    window.parent.postMessage(
      {
        action: "sidebar_width_changed",
        width: widthValue,
      },
      "*"
    );
  }
}

// switch from welcome to chat view
export function switchToChat() {
  // hide chat history
  // elements.chatHistoryScreen.style.display = "none";

  // show chat
  elements.chatScreen.style.display = "flex";

  // focus input
  elements.userInput.focus();

  if (!elements.chatContainer.querySelector(".welcome-container")) {
    const welcomeContainer = createWelcomeContainer();
    elements.chatContainer.prepend(welcomeContainer);
  }
  if (!elements.chatContainer.querySelector(".chat-actions-container")) {
    // inject chat actions container if not exists
    const chatActionsContainer = createChatActionsContainer();
    elements.chatContainer.appendChild(chatActionsContainer);
  }
}

/**
 * Add message element to chat screen.
 * Assistant messages are attached a message ID.
 * @param {String} message Message content
 * @param {String} role
 * @param {String} messageId
 * @param {String} tempMessageId
 * @returns {HTMLElement} Message element
 */
export async function addMessageToChat(
  message,
  role,
  messageId = null,
  tempMessageId
) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}-message`;

  // Set message ID attributes
  if (messageId) {
    messageElement.setAttribute("data-message-id", messageId);
  } else if (tempMessageId) {
    messageElement.setAttribute("data-temp-message-id", tempMessageId);
  }

  if (role === "assistant") {
    messageElement.innerHTML = `
      <div class="message-content">${formatMessage(message)}</div>
    `;
    // If vaid messageID is provided, display feedback icon
    if (messageId) {
      addFeedbackIconToMessage(messageElement);
    }
  } else {
    messageElement.innerHTML = `
      <div class="message-content">${formatMessage(message)}</div>
    `;
  }

  // Insert message before actions container so actions stay at the bottom
  const actionsContainer = elements.chatContainer.querySelector(
    ".chat-actions-container"
  );
  if (actionsContainer) {
    elements.chatContainer.insertBefore(messageElement, actionsContainer);
  } else {
    elements.chatContainer.appendChild(messageElement);
  }
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

/**
 * Clear all messages from chat container.
 *
 * Inject welcome section and quick actions & suggested questions
 * and context indicator into chat container
 */
export async function clearMessagesFromChatContainer() {
  if (!elements.chatContainer) return;
  elements.chatContainer.innerHTML = "";

  const welcomeContainer = createWelcomeContainer();
  elements.chatContainer.prepend(welcomeContainer);

  // Create a container for both quick actions and suggested questions
  const chatActionsContainer = createChatActionsContainer();
  elements.chatContainer.appendChild(chatActionsContainer);

  updateContentStatus();
}

/**
 * Update message element with real message ID and show feedback icon
 * @param {String} tempMessageId Temporary message ID
 * @param {String} realMessageId Real message ID from backend
 */
export function updateMessageWithId(tempMessageId, realMessageId) {
  const messageElement = document.querySelector(
    `[data-temp-message-id="${tempMessageId}"]`
  );
  if (messageElement) {
    // Remove temp ID and set real message ID
    messageElement.removeAttribute("data-temp-message-id");
    messageElement.setAttribute("data-message-id", realMessageId);

    // Now show the feedback icon since we have a real message ID
    addFeedbackIconToMessage(messageElement);
  }
}

/**
 * Add a feedback icon to the message element
 * @param {HTMLElement} messageElement
 */
function addFeedbackIconToMessage(messageElement) {
  // Check if feedback icon already exists
  if (messageElement.querySelector(".feedback-button")) return;

  const feedbackButton = document.createElement("button");
  feedbackButton.className = "feedback-button";
  feedbackButton.title = "Send feedback";
  feedbackButton.innerHTML = `
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z"/>
    </svg>
  `;
  feedbackButton.onclick = (event) => {
    const messageId = messageElement.dataset.messageId;
    console.log("Message Id: ", messageId);
    showFeedbackModal(messageId);
  };

  messageElement.appendChild(feedbackButton);
}

/**
 * Create a welcome container inside #chat-container, the container includes a logo and title
 * @returns {HTMLElement}
 */
function createWelcomeContainer() {
  const welcomeContainer = document.createElement("div");
  welcomeContainer.className = "welcome-container";

  welcomeContainer.innerHTML = `
    <img
      src="./icons/logo.png"
      alt="logo"
      id="welcome-logo"
    />
    <h3 data-i18n="welcome">Ask me anything about this webpage</h3>
  `;

  return welcomeContainer;
}

/**
 * Creates and returns the chat actions container with quick actions and suggested questions.
 * @returns {HTMLElement} The chat actions container element.
 */
function createChatActionsContainer() {
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "chat-actions-container";

  injectQuickActions(actionsContainer);
  injectSuggestedQuestions(actionsContainer);

  return actionsContainer;
}

/**
 * Inject quick action buttons inside parent element.
 * @param {HTMLElement} container Parent element
 */
function injectQuickActions(container) {
  const quickActions = document.createElement("div");
  quickActions.className = "quick-actions";
  quickActions.innerHTML = `
    <h3 data-i18n="quickActions">Quick Actions</h3>
    <div class="action-buttons-container">
      <button class="action-button" data-action="summarize">
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6H6m12 4H6m12 4H6m12 4H6"/>
        </svg>
        <span data-i18n="summarize">Summarize this page for me.</span>
      </button>
      <button class="action-button" data-action="keypoints">
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6h8m-8 6h8m-8 6h8M4 16a2 2 0 1 1 3.321 1.5L4 20h5M4 5l2-1v6m-2 0h4"/>
        </svg>
        <span data-i18n="keyPoints">What are the key points of this page?</span>
      </button>
      <button class="action-button" data-action="explain">
      <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.529 9.988a2.502 2.502 0 1 1 5 .191A2.441 2.441 0 0 1 12 12.582V14m-.01 3.008H12M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
      </svg>
        <span data-i18n="explain">Explain this page to me as if I'm a beginner.</span>
      </button>
    </div>
  `;
  container.appendChild(quickActions);

  setupQuickActionsEvent(container);
}

/**
 * Inject suggested questions inside parent element
 * @param {HTMLElement} container Parent element
 */
function injectSuggestedQuestions(container) {
  const suggestedQuestionsContainer = document.createElement("div");
  suggestedQuestionsContainer.className = "suggested-questions-container";
  suggestedQuestionsContainer.style.width = "100%";
  suggestedQuestionsContainer.innerHTML = `
    <button class="action-button generate-questions-button" style="width:100%">
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.556 8.5h8m-8 3.5H12m7.111-7H4.89a.896.896 0 0 0-.629.256.868.868 0 0 0-.26.619v9.25c0 .232.094.455.26.619A.896.896 0 0 0 4.89 16H9l3 4 3-4h4.111a.896.896 0 0 0 .629-.256.868.868 0 0 0 .26-.619v-9.25a.868.868 0 0 0-.26-.619.896.896 0 0 0-.63-.256Z"/>
    </svg>

      <span data-i18n="generate-questions">Generate questions about this page</span>
    </button>
    <div class="question-loading" style="display:none;margin-top:12px;">
      <div class="spinner-small"></div>
      <span>Generating questions...</span>
    </div>
    <div class="question-buttons-container" style="margin-top:12px;"></div>
  `;
  container.appendChild(suggestedQuestionsContainer);

  const generateQuestionsButton = suggestedQuestionsContainer.querySelector(
    ".generate-questions-button"
  );
  const loadingDiv =
    suggestedQuestionsContainer.querySelector(".question-loading");
  const questionButtonsContainer = suggestedQuestionsContainer.querySelector(
    ".question-buttons-container"
  );

  generateQuestionsButton.addEventListener("click", async () => {
    generateQuestionsButton.style.display = "none";
    loadingDiv.style.display = "flex";
    questionButtonsContainer.innerHTML = "";

    let result;

    // Use generated questions if have
    if (state.generatedQuestions) {
      result = {
        success: true,
        questions: state.generatedQuestions,
      };
    } else {
      result = await generateQuestionsFromContent(state.pageContent);
    }

    loadingDiv.style.display = "none";

    // Render generated questions
    if (result && result.success && Array.isArray(result.questions)) {
      questionButtonsContainer.innerHTML = "";
      result.questions.forEach((question) => {
        const questionButton = document.createElement("button");
        questionButton.className = "question-button";
        questionButton.innerHTML = `
          <span>${question}</span>
        `;
        questionButton.onclick = async () => {
          if (state.isProcessingQuery) return; // Avoid spam
          processUserQuery(question);
          questionButton.remove();
        };
        questionButtonsContainer.appendChild(questionButton);
      });

      // Only store generated questions when it's displayabled
      state.generatedQuestions = result.questions;
    } else {
      questionButtonsContainer.innerHTML = `<div style="color:#E53E3E;">Failed to generate questions.</div>`;
      generateQuestionsButton.style.display = "block";
    }
  });
}

/**
 * Clear chat history list
 */
export function clearChatHistoryList() {
  if (elements.chatHistoryList) {
    elements.chatHistoryList.innerHTML = "";
  }
}

async function showFeedbackModal(messageId) {
  console.log("Message ID for feedback: ", messageId);
  const userSession = await getUserSession();
  if (!userSession) {
    alert("you need to login to give feedback");
    return;
  }

  if (document.getElementById("cocbot-feedback-modal")) return;

  // Add blur to sidebar
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.add("cocbot-blur");

  const modal = document.createElement("div");
  modal.id = "cocbot-feedback-modal";
  modal.innerHTML = `
    <div class="cocbot-modal-backdrop"></div>
    <div class="cocbot-modal-content feedback-modal">
      <h2 class="feedback-title" data-i18n="feedbackTitle">Give Feedback</h2>
      <div class="feedback-subtitle">Rate your experience with Briefly</div>
      ${renderStars()}
      <div class="feedback-reason-label">
        Write your feedback <span class="optional-label">(optional)</span>
      </div>
      <textarea class="feedback-reason-input" placeholder="please write here"></textarea>
      <div class="feedback-modal-actions">
        <button class="action-button feedback-submit">Submit</button>
        <button class="action-button feedback-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Đóng modal khi click backdrop
  modal
    .querySelector(".cocbot-modal-backdrop")
    .addEventListener("click", () => {
      modal.remove();
      if (sidebar) sidebar.classList.remove("cocbot-blur");
    });

  // Ngăn nổi bọt khi click vào modal content
  modal
    .querySelector(".cocbot-modal-content")
    .addEventListener("click", (e) => {
      e.stopPropagation();
    });

  // Star rating logic
  const ratingItems = modal.querySelectorAll(".feedback-rating-item");
  let selectedRate = null;
  const submitBtn = modal.querySelector(".feedback-submit");
  submitBtn.disabled = true; // Disable submit ban đầu

  ratingItems.forEach((item, idx) => {
    item.addEventListener("mouseenter", () => {
      ratingItems.forEach((el, i) => {
        el.classList.toggle("hovered", i <= idx);
        el.classList.toggle(
          "selected",
          selectedRate && i < selectedRate && i <= idx
        );
      });
    });
    item.addEventListener("mouseleave", () => {
      ratingItems.forEach((el) => el.classList.remove("hovered"));
      ratingItems.forEach((el, i) => {
        el.classList.toggle("selected", selectedRate && i < selectedRate);
      });
    });
    item.addEventListener("click", () => {
      if (selectedRate === idx + 1) {
        selectedRate = null;
        ratingItems.forEach((el) => el.classList.remove("selected"));
        submitBtn.disabled = true; // Disable khi bỏ chọn
      } else {
        selectedRate = idx + 1;
        ratingItems.forEach((el, i) => {
          el.classList.toggle("selected", i < selectedRate);
        });
        submitBtn.disabled = false; // Enable khi đã chọn
      }
    });
  });

  // Submit/cancel logic
  submitBtn.onclick = async () => {
    if (submitBtn.disabled) return;
    const stars = selectedRate;
    const comment = modal.querySelector(".feedback-reason-input").value.trim();

    try {
      const response = await sendRequest(
        `https://dev-capstone-2025.coccoc.com/api/feedback`,
        {
          method: "POST",
          body: {
            stars,
            comment,
            message_id: parseInt(messageId),
          },
        }
      );
      if (response.success) {
        showToast("Feedback received!");
        modal.remove();
        if (sidebar) sidebar.classList.remove("cocbot-blur");
      } else {
        showToast("Something went wrong, please try again later.");
      }
    } catch (err) {
      console.error(err);
      showToast("Something went wrong, please try again later.");
    }
  };

  function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "24px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#222";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 99999;
    toast.style.fontSize = "1rem";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    toast.style.opacity = "0.92";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  const cancelBtn = modal.querySelector(".feedback-cancel");
  cancelBtn.onclick = () => {
    modal.remove();
    if (sidebar) sidebar.classList.remove("cocbot-blur");
  };
}

/**
 * Create stars rating row using Font Awesome SVG
 * @returns {string}
 */
function renderStars() {
  const starSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="32" height="32" class="feedback-rating-item" data-rate="{RATE}">
      <path fill="#FFD43B" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
    </svg>
  `;

  return `
    <div class="feedback-rating-row">
      ${[1, 2, 3, 4, 5].map((i) => starSVG.replace("{RATE}", i)).join("")}
    </div>
  `;
}

// format markdown-like text
export function formatMessage(message) {
  return message
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

// show typing indicator
export function addTypingIndicator() {
  const typingElement = document.createElement("div");
  typingElement.className = "typing-indicator";
  typingElement.innerHTML = "<span></span><span></span><span></span>";

  const actionsContainer = elements.chatContainer.querySelector(
    ".chat-actions-container"
  );
  if (actionsContainer) {
    elements.chatContainer.insertBefore(typingElement, actionsContainer);
  } else {
    elements.chatContainer.appendChild(typingElement);
  }

  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

  return typingElement;
}

// remove typing indicator
export function removeTypingIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

// handle messages from content script
export function handleContentMessage(message) {
  switch (message.action) {
    case "page_content":
      console.log("CocBot: Got page content");
      state.pageContent = message.content;

      // update ui
      updateContentStatus();

      // if notes panel is open, refresh notes for new URL
      if (state.isNotesOpen && state.pageContent.url !== state.currentPageUrl) {
        state.currentPageUrl = state.pageContent.url;
        openNotesPanel();
      }
      break;

    case "refresh_page_content":
      console.log("CocBot: URL changed, requesting fresh content");

      // Reset content extraction state
      state.contentFetchAttempts = 0;
      state.pageContent = null;

      // Request fresh content
      requestPageContent();

      // If in welcome mode, reset any generated questions
      state.generatedQuestions = null;
      const questionsContainer = document.querySelector(".generated-questions");
      if (questionsContainer) {
        questionsContainer.style.display = "none";
      }

      break;

    case "auth_session_changed":
      console.log("Auth state changed event received, updating UI!");
      handleAuthStateChange(message.isAuth);
      break;
    case "session_expired":
      showPopupDialog({
        title: "Session Expired",
        message:
          "Your session has expired and you have been signed out for security reasons",
      });
      break;
    case "sign_in_required":
      showSignInAlertPopup();
      break;
  }
}

// helper function to escape HTML
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle events when authentication state changes
 * @param {boolean} isAuth Authentication state
 */
function handleAuthStateChange(isAuth) {
  // Reset UI
  renderToggleAccountPopupUI(isAuth);
  clearMessagesFromChatContainer();
  clearChatHistoryList();

  state.isChatHistoryEventsInitialized = false;

  // Inject or remove dynamic chat history elements based on authentication state
  configureChatHistoryElementsOnAuthState(isAuth);

  // Navigate back to welcome page
  closeAllScreensAndPanels();

  // Reset state
  resetCurrentChatState();
  resetPaginationState();
  state.chatHistory = [];

  // hide chat history
  elements.chatHistoryScreen.style.display = "none";

  updateContentStatus();
}

/**
 * Inject or remove chat history elements based on authentication state.
 * And attach reference to new elements
 * @param {boolean} isAuth Authenticated state
 */
export function configureChatHistoryElementsOnAuthState(isAuth) {
  const sidebarContentWrapper = document.querySelector(
    ".sidebar-content-wrapper"
  );
  let chatHistoryScreen = document.getElementById("chat-history-screen");
  let chatHistoryButton = document.getElementById("chat-history-button");

  // Helper function to create chat history button
  function createChatHistoryButton() {
    const button = document.createElement("button");
    button.id = "chat-history-button";
    button.className = "icon-button";
    button.setAttribute("data-i18n-title", "chatHistory");
    button.innerHTML = `
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3M3.22302 14C4.13247 18.008 7.71683 21 12 21c4.9706 0 9-4.0294 9-9 0-4.97056-4.0294-9-9-9-3.72916 0-6.92858 2.26806-8.29409 5.5M7 9H3V5"
        />
      </svg>
    `;
    return button;
  }

  if (isAuth) {
    // Inject chat history screen if not present
    if (!chatHistoryScreen) {
      console.log("Chat history screen not found, injecting new");
      chatHistoryScreen = document.createElement("div");
      chatHistoryScreen.id = "chat-history-screen";
      chatHistoryScreen.style.display = "none";
      chatHistoryScreen.innerHTML = `
          <div class="chat-history-header">
            <h3 data-i18n="chatHistory">Chat History</h3>
            <div class="chat-history-header-actions">
              <button
                id="clear-chat-history-button"
                class="icon-button"
                data-i18n-title="clearHistory"
              >
                <svg
                  class="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
                  />
                </svg>
              </button>
              <button
                id="refresh-chat-history-button"
                class="icon-button"
                data-i18n-title="refreshHistory"
              >
                <svg
                  class="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"
                  />
                </svg>
              </button>
              <button
                id="close-chat-history-button"
                class="icon-button"
                title="Close"
              >
                <svg
                  class="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18 17.94 6M18 18 6.06 6"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div id="chat-history-content">
            <div id="chat-history-list"></div>
            <div id="chat-history-empty" style="display: none">
              <p data-i18n="noChats">No chat history yet.</p>
            </div>
          </div>
      `;

      // Inject chat history screen
      sidebarContentWrapper.appendChild(chatHistoryScreen);

      // Reference to new chat history elements
      elements.chatHistoryScreen = chatHistoryScreen;
      elements.chatHistoryList =
        chatHistoryScreen.querySelector("#chat-history-list");
      elements.chatHistoryEmpty = chatHistoryScreen.querySelector(
        "#chat-history-empty"
      );
    }

    // Inject chat history button if not present
    if (!chatHistoryButton) {
      console.log("Chat history button not found, injecting new");
      const newChatBtn = document.querySelector("#new-chat-button");
      chatHistoryButton = createChatHistoryButton();
      newChatBtn.insertAdjacentElement("afterend", chatHistoryButton);
    }

    setupListenersForDynamicChatHistoryElements();
  } else {
    // Remove chat history screen if present
    if (chatHistoryScreen) {
      chatHistoryScreen.remove();
    }
    // Remove chat history button if present
    if (chatHistoryButton) {
      chatHistoryButton.remove();
    }
  }
}
