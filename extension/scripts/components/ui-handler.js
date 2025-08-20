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
import { translateElement } from "./i18n.js";

/**
 * Close all screens and panels beside chat screen as it's main screen
 */
export function closeAllScreensAndPanels() {
  // hide config
  if (elements.configContainer) {
    elements.configContainer.style.display = "none";
  }
  if (elements.configButton) {
    elements.configButton.classList.remove("active");
  }
  state.isConfigOpen = false;

  // hide notes
  if (elements.notesScreen) {
    elements.notesScreen.style.display = "none";
  }
  if (elements.notesButton) {
    elements.notesButton.classList.remove("active");
  }
  state.isNotesOpen = false;

  const toolbar = document.querySelector(".sidebar-toolbar");
  if (toolbar) {
    toolbar.classList.remove("notes-open");
  }

  // hide sign in alert
  if (elements.signInAlertOverlay) {
    elements.signInAlertOverlay.style.display = "none";
  }

  // hide account popup
  if (elements.accountPopup) {
    elements.accountPopup.style.display = "none";
  }

  // hide chat history screen
  if (elements.chatHistoryScreen) {
    elements.chatHistoryScreen.style.display = "none";
  }
  const chatHistoryButton = document.getElementById("chat-history-button");
  if (chatHistoryButton) {
    chatHistoryButton.classList.remove("active");
  }

  // show main screen - safe access
  if (elements.chatScreen) {
    elements.chatScreen.style.display = "flex";
  }
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

/**
 * Switch to chat screen
 */
export function switchToChat() {
  // show chat
  elements.chatScreen.style.display = "flex";
  // focus input
  elements.userInput.focus();
}

/**
 * Add message element to chat screen.
 * Assistant messages are attached a message ID.
 * @param {Object} options Configuration object
 * @param {String} options.message Message content
 * @param {"user" | "assistant"} options.role
 * @param {String} [options.messageId]
 * @param {String} [options.tempMessageId]
 * @param {String} [options.event]
 * @returns {HTMLElement} Message element
 */
export async function addMessageToChat({
  message,
  role,
  messageId = null,
  tempMessageId = null,
  event = null,
}) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}-message`;

  // Set ID
  if (messageId) {
    messageElement.setAttribute("data-message-id", messageId);
  } else if (tempMessageId) {
    messageElement.setAttribute("data-temp-message-id", tempMessageId);
  }

  // Conditionally add data-i18n if event is not "ask"
  const i18nAttribute = event && event !== "ask" ? `data-i18n="${event}"` : "";

  messageElement.innerHTML = `
    <div class="message-content" ${i18nAttribute}>
      ${formatMessage(message)}
    </div>
  `;

  // Add feedback icon for assistant replies
  if (role === "assistant" && messageId) {
    addFeedbackIconToMessage(messageElement);
  }

  translateElement(messageElement);

  elements.messageContainer.appendChild(messageElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

  return messageElement;
}

/**
 * Clear all messages from chat container.
 */
export async function clearMessagesFromMessageContainer() {
  if (!elements.messageContainer) return;
  elements.messageContainer.innerHTML = "";
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
    translateElement(messageElement);
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
  feedbackButton.dataset.i18nTitle = "sendFeedback";
  feedbackButton.innerHTML = `
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17h6l3 3v-3h2V9h-2M4 4h11v8H9l-3 3v-3H4V4Z"/>
    </svg>
  `;
  feedbackButton.onclick = (event) => {
    const messageId = messageElement.dataset.messageId;
    showFeedbackModal(messageId);
  };

  messageElement.appendChild(feedbackButton);
}

/**
 * Create a welcome container inside #chat-container, the container includes a logo and title
 * @returns {HTMLElement}
 */
export function createWelcomeContainer() {
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

  translateElement(welcomeContainer);

  return welcomeContainer;
}

/**
 * Creates and returns the chat actions container with quick actions and suggested questions.
 * @returns {HTMLElement} The chat actions container element.
 */
export function createChatActionsContainer() {
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

  translateElement(quickActions);

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
      <span data-i18n=generatingQuestions>Generating questions...</span>
    </div>
    <div class="question-buttons-container" style="margin-top:12px;"></div>
  `;
  container.appendChild(suggestedQuestionsContainer);

  translateElement(suggestedQuestionsContainer);

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
    if (
      state.generatedQuestions[state.language] &&
      state.generatedQuestions[state.language].length > 0 &&
      !state.isUsingChatContext
    ) {
      result = {
        success: true,
        questions: state.generatedQuestions[state.language],
      };
    } else {
      result = await generateQuestionsFromContent();
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
      state.generatedQuestions[state.language] = result.questions;
    } else {
      questionButtonsContainer.innerHTML = `<div style="color:#E53E3E;">Failed to generate questions.</div>`;
      generateQuestionsButton.style.display = "block";
    }
  });
}

/**
 * Clear all suggested questions and display generate question button.
 *
 * Stop is there's are questions being generated
 */
export function resetSuggestedQuestionsContainer() {
  if (state.isGeneratingQuestions) return;
  const suggestedQuestionsContainer = document.querySelector(
    ".suggested-questions-container"
  );
  if (suggestedQuestionsContainer) {
    const generateQuestionsButton = suggestedQuestionsContainer.querySelector(
      ".generate-questions-button"
    );
    const questionButtonsContainer = suggestedQuestionsContainer.querySelector(
      ".question-buttons-container"
    );

    // Clear all questions
    if (questionButtonsContainer) {
      questionButtonsContainer.innerHTML = "";
    }

    generateQuestionsButton.style.display = "flex";
  }
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
  const userSession = await getUserSession();
  if (!userSession) {
    showSignInAlertPopup();
    return;
  }

  // Prevent opening multiple modals
  if (document.getElementById("cocbot-feedback-modal")) return;

  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.add("cocbot-blur");

  // Create modal element
  const modal = document.createElement("div");
  modal.id = "cocbot-feedback-modal";
  modal.innerHTML = generateFeedbackModalHTML();
  document.body.appendChild(modal);

  translateElement(modal);

  // Close modal and remove blur
  function closeModal() {
    modal.remove();
    if (sidebar) sidebar.classList.remove("cocbot-blur");
  }

  // Event: Click outside to close
  modal
    .querySelector(".cocbot-modal-backdrop")
    .addEventListener("click", closeModal);

  // Prevent modal click from closing
  modal
    .querySelector(".cocbot-modal-content")
    .addEventListener("click", (e) => {
      e.stopPropagation();
    });

  // Star rating logic
  let selectedRate = null;
  const ratingItems = modal.querySelectorAll(".feedback-rating-item");
  const submitBtn = modal.querySelector(".feedback-submit");
  const cancelBtn = modal.querySelector(".feedback-cancel");

  submitBtn.disabled = true;

  ratingItems.forEach((item, index) => {
    item.addEventListener("mouseenter", () => updateStars(index));
    item.addEventListener("mouseleave", restoreStars);
    item.addEventListener("click", () => selectStars(index));
  });

  cancelBtn.onclick = closeModal;

  submitBtn.onclick = async () => {
    if (submitBtn.disabled) return;

    const stars = selectedRate;
    const comment = modal.querySelector(".feedback-reason-input").value.trim();

    const toastId = showToast({
      message:
        state.language === "en" ? "Submitting feedback" : "Đang gửi góp ý",
      type: "loading",
      duration: null,
    });

    try {
      const response = await sendRequest(`http://localhost:3000/api/feedback`, {
        method: "POST",
        body: { stars, comment, message_id: parseInt(messageId) },
      });

      if (response.success) {
        updateToast(toastId, {
          message:
            state.language === "en" ? "Feedback submitted" : "Gửi thành công",
          type: "success",
          duration: 2000,
        });
      } else {
        updateToast(toastId, {
          message:
            state.language === "en"
              ? "Something went wrong, please try again later"
              : "Đã xảy ra lỗi, vui lòng thử lại sau",
          type: "error",
          duration: 2000,
        });
      }
    } catch (err) {
      console.error(err);
      updateToast(toastId, {
        message:
          state.language === "en"
            ? "Something went wrong, please try again later"
            : "Đã xảy ra lỗi, vui lòng thử lại sau",
        type: "error",
        duration: 2000,
      });
    } finally {
      closeModal();
    }
  };

  // Helper: Fill stars on hover
  function updateStars(hoverIndex) {
    ratingItems.forEach((el, i) => {
      el.classList.toggle("hovered", i <= hoverIndex);
      el.classList.toggle(
        "selected",
        selectedRate && i < selectedRate && i <= hoverIndex
      );
    });
  }

  // Helper: Restore stars on leave
  function restoreStars() {
    ratingItems.forEach((el, i) => {
      el.classList.remove("hovered");
      el.classList.toggle("selected", selectedRate && i < selectedRate);
    });
  }

  // Helper: Select/deselect stars
  function selectStars(index) {
    if (selectedRate === index + 1) {
      selectedRate = null;
      ratingItems.forEach((el) => el.classList.remove("selected"));
      submitBtn.disabled = true;
    } else {
      selectedRate = index + 1;
      ratingItems.forEach((el, i) => {
        el.classList.toggle("selected", i < selectedRate);
      });
      submitBtn.disabled = false;
    }
  }
}

/**
 * Generate raw HTML for feedback modal
 */
function generateFeedbackModalHTML() {
  return `
    <div class="cocbot-modal-backdrop"></div>
    <div class="cocbot-modal-content feedback-modal">
      <h2 class="feedback-title" data-i18n="feedbackTitle">Give Feedback</h2>
      <div class="feedback-subtitle" data-i18n="feedbackSubtitle">Rate your experience with Briefly</div>
      ${renderStars()}
      <div class="feedback-reason-label" data-i18n="feedbackReasonLabel">
        Write your feedback <span class="optional-label" data-i18n="optionalLabel">(optional)</span>
      </div>
      <textarea class="feedback-reason-input" data-i18n-placeholder="feedbackPlaceholder" placeholder="please write here"></textarea>
      <div class="feedback-modal-actions">
        <button class="action-button feedback-submit" data-i18n="submitFeedback">Submit</button>
        <button class="action-button feedback-cancel" data-i18n="cancel">Cancel</button>
      </div>
    </div>
  `;
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

/**
 * Show a dynamic toast notification
 * @param {Object} options
 * @param {string} options.message The main toast text
 * @param {'info'|'success'|'error'|'loading'} [options.type='info'] Toast category
 * @param {number|null} [options.duration] Duration in ms. If null, stays until removed manually
 * @returns {string} toastId Can be used to update/dismiss later
 */
export function showToast({ message, type = "info", duration = 2000 }) {
  const toastId = `toast-${state.toastIdCounter++}`;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.id = toastId;

  const icon = getToastIcon(type);
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  document.body.appendChild(toast);

  if (duration !== null) {
    setTimeout(() => removeToast(toastId), duration);
  }

  return toastId;
}

/**
 * Update an existing toast by ID
 * @param {string} toastId
 * @param {Object} options
 * @param {string} [options.message]
 * @param {'info'|'success'|'error'|'loading'} [options.type]
 * @param {number|null} [options.duration] Reset or extend timeout
 */
export function updateToast(toastId, { message, type, duration }) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  if (message) toast.querySelector(".toast-message").textContent = message;
  if (type) {
    toast.className = `toast toast-${type}`;
    toast.querySelector(".toast-icon").innerHTML = getToastIcon(type);
  }

  if (duration !== undefined) {
    setTimeout(() => removeToast(toastId), duration);
  }
}

/**
 * Remove a toast by ID
 * @param {string} toastId
 */
export function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) toast.remove();
}

/**
 * Get icon HTML by type
 */
function getToastIcon(type) {
  switch (type) {
    case "success":
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="toast-icon">
          <path fill="currentColor" d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"/>
        </svg>
        `;
    case "error":
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="toast-icon">
          <path fill="currentColor" d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"/>
        </svg>
      `;
    case "loading":
      return `<span class="toast-spinner"></span>`;
    case "info":
    default:
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512" class="toast-icon">
          <path fill="currentColor" d="M48 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM0 192c0-17.7 14.3-32 32-32l64 0c17.7 0 32 14.3 32 32l0 256 32 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 512c-17.7 0-32-14.3-32-32s14.3-32 32-32l32 0 0-224-32 0c-17.7 0-32-14.3-32-32z"/>
        </svg>
      `;
  }
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
      console.log("URL changed, requesting fresh content");

      // Reset content extraction state
      state.contentFetchAttempts = 0;
      state.pageContent = null;

      // Request fresh content
      requestPageContent();

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
  clearMessagesFromMessageContainer();
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
                data-i18n-title="close"
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
