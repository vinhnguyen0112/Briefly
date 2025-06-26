// ui interaction stuff
import { elements } from "./dom-elements.js";
import {
  state,
  saveSidebarWidth,
  resetCurrentChatState,
  resetPaginationState,
} from "./state.js";
import {
  renderContentInSidebar,
  requestPageContent,
  updateContentStatus,
} from "./content-handler.js";
import {
  renderToggleAccountPopupUI,
  setupChatHistoryEvents,
  showPopupAlert,
  showSignInAlertPopup,
  toggleChatHistoryScreen,
} from "./event-handler.js";

// close all panels
export function closeAllPanels() {
  // hide settings
  elements.apiKeyContainer.style.display = "none";
  elements.settingsButton.classList.remove("active");
  state.isSettingsOpen = false;

  // hide config
  elements.configContainer.style.display = "none";
  elements.configButton.classList.remove("active");
  state.isConfigOpen = false;

  // hide content viewer
  elements.contentViewerScreen.style.display = "none";
  elements.viewContentButton.classList.remove("active");
  state.isContentViewerOpen = false;

  // hide notes
  elements.notesScreen.style.display = "none";
  elements.notesButton.classList.remove("active");
  state.isNotesOpen = false;

  // hide sign in alert
  elements.signInAlertOverlay.style.display = "none";

  // show main screen
  if (state.welcomeMode) {
    elements.welcomeScreen.style.display = "flex";
  } else {
    elements.chatScreen.style.display = "flex";
  }
}

// set up quick action buttons
export function setupQuickActions() {
  // hook up each button
  elements.quickActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      let query = "";

      switch (action) {
        case "summarize":
          query = "Summarize this page in a concise way.";
          break;
        case "keypoints":
          query = "What are the key points of this page?";
          break;
        case "explain":
          query = "Explain the content of this page as if I'm a beginner.";
          break;
      }

      if (query) {
        // jump to chat and fire the query
        switchToChat();
        processUserQuery(query);
      }
    });
  });
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
  if (!state.welcomeMode) return;

  state.welcomeMode = false;

  // hide welcome
  elements.welcomeScreen.style.display = "none";

  // hide chat history
  elements.chatHistoryScreen.style.display = "none";

  // show chat
  elements.chatScreen.style.display = "flex";

  // focus input
  elements.userInput.focus();

  // remember generated questions so they appear when switching back
  const existingQuestions = state.generatedQuestions;

  // store a reference to switch back
  const backButton = document.createElement("button");
  backButton.className = "back-button";
  backButton.textContent = "← Back";
  backButton.onclick = () => {
    // Hide chat screen
    elements.chatScreen.style.display = "none";

    console.log("Current stack: ", state.screenStack);
    // Check screen stack
    if (state.screenStack[state.screenStack.length - 1] === "history") {
      elements.chatHistoryScreen.style.display = "flex";
      // If we only history screen is in the stack (excluding welcome screen)
      // Render welcome screen
      if (state.screenStack.length <= 1) {
        renderWelcomeScreen(existingQuestions);
      }
    } else {
      renderWelcomeScreen(existingQuestions);
    }

    backButton.remove();
  };

  if (!document.querySelector(".back-button")) {
    document.querySelector(".sidebar-content").prepend(backButton);
  }
}

function renderWelcomeScreen(existingQuestions) {
  state.welcomeMode = true;
  elements.welcomeScreen.style.display = "flex";
  // restore questions if we had them
  if (existingQuestions && existingQuestions.length > 0) {
    state.generatedQuestions = existingQuestions;
    const questionsContainer = document.querySelector(".generated-questions");
    const buttonContainer = document.querySelector(
      ".question-buttons-container"
    );

    if (questionsContainer && buttonContainer) {
      questionsContainer.style.display = "block";
      buttonContainer.innerHTML = "";

      existingQuestions.forEach((question) => {
        const questionButton = document.createElement("button");
        questionButton.className = "question-button";
        questionButton.textContent = question;
        questionButton.onclick = () => {
          switchToChat();
          processUserQuery(question);
        };

        buttonContainer.appendChild(questionButton);
      });
    }
  }
}

// add message to chat
export function addMessageToChat(message, role) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}-message`;
  messageElement.innerHTML = `
    <div class="message-content">${formatMessage(message)}</div>
  `;

  elements.chatContainer.appendChild(messageElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// Clear all chat messages from the chat container
export function clearMessagesFromChat() {
  if (elements.chatContainer) {
    elements.chatContainer.innerHTML = "";
  }
}

export function clearChatHistory() {
  if (elements.chatHistoryList) {
    elements.chatHistoryList.innerHTML = "";
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

  elements.chatContainer.appendChild(typingElement);
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

      // update viewer if open
      if (elements.contentViewerScreen.style.display !== "none") {
        renderContentInSidebar(state.pageContent);
      }

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
      if (state.welcomeMode) {
        state.generatedQuestions = null;
        const questionsContainer = document.querySelector(
          ".generated-questions"
        );
        if (questionsContainer) {
          questionsContainer.style.display = "none";
        }
      }

      // Show loading indicator if content viewer is open
      if (elements.contentViewerScreen.style.display !== "none") {
        elements.contentDisplay.innerHTML = `
          <div class="content-viewer-loading">
            <div class="spinner"></div>
            <p>Loading content for new page...</p>
          </div>
        `;
      }
      break;

    case "auth_session_changed":
      console.log("Auth state changed event received, updating UI!");
      handleAuthStateChange(message.isAuth);
      break;
    case "session_expired":
      showPopupAlert({
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

// Handle UI changes when authentication state changes
function handleAuthStateChange(isAuth) {
  // Reset UI
  renderToggleAccountPopupUI(isAuth);
  clearMessagesFromChat();
  clearChatHistory();

  state.isChatHistoryEventsInitialized = false;

  // Inject or remove chat history screen based on user session state
  injectChatHistoryElements(isAuth);

  // Navigate back to welcome page
  state.welcomeMode = true;
  closeAllPanels();

  // Reset state
  resetCurrentChatState();
  resetPaginationState();
  state.chatHistory = [];

  // Close chat screen
  elements.chatScreen.style.display = "none";
  // hide chat history
  elements.chatHistoryScreen.style.display = "none";
}

export function injectChatHistoryElements(isAuth) {
  const sidebarContentWrapper = document.querySelector(
    ".sidebar-content-wrapper"
  );
  let chatHistoryScreen = document.getElementById("chat-history-screen");
  let chatHistoryButton = document.getElementById("chat-history-button");

  // Helper function to create chat history button
  function createChatHistoryButton() {
    const btn = document.createElement("button");
    btn.id = "chat-history-button";
    btn.innerHTML = `
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
    return btn;
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
            <button
              id="close-chat-history-button"
              class="icon-button"
              title="Close"
            >
              ×
            </button>
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

    setupChatHistoryEvents();
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
