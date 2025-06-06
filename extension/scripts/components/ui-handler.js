// ui interaction stuff
import { elements } from "./dom-elements.js";
import { state, saveSidebarWidth, resetCurrentChat } from "./state.js";
import {
  renderContentInSidebar,
  requestPageContent,
  updateContentStatus,
} from "./content-handler.js";
import { renderToggleAccountPopupUI } from "./event-handler.js";

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

  // hide chat history
  elements.chatHistoryScreen.style.display = "none";

  // hide sign in alert
  elements.signInAlertOverlay.style.display = "none";

  // hide session expired alert
  elements.sessionExpiredAlertOverlay.style.display = "none";

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

  // show chat
  elements.chatScreen.style.display = "flex";

  // focus input
  elements.userInput.focus();

  // remember generated questions so they appear when switching back
  const existingQuestions = state.generatedQuestions;

  // store a reference to switch back
  const backButton = document.createElement("button");
  backButton.className = "back-to-welcome-button";
  backButton.textContent = "← Back";
  backButton.onclick = () => {
    state.welcomeMode = true;
    elements.chatScreen.style.display = "none";
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

    backButton.remove();
  };

  if (!document.querySelector(".back-to-welcome-button")) {
    document.querySelector(".sidebar-content").prepend(backButton);
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
      // TODO: Test this with edge cases
      handleAuthStateChange(message.isAuth);
      break;
    case "session_expired":
      // Show session expired alert overlay
      elements.sessionExpiredAlertOverlay.style.display = "flex";
      break;
    case "sign_in_required":
      elements.signInAlertOverlay.style.display = "flex";
      break;
  }
}

// helper function to escape HTML
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Handle UI and state changes when authentication state changes
function handleAuthStateChange(isAuth) {
  // Refresh UI
  renderToggleAccountPopupUI(isAuth);
  clearMessagesFromChat();

  // Reset welcomeMode upon auth state change
  state.welcomeMode = true;
  closeAllPanels();
  // Force close chat screen
  elements.chatScreen.style.display = "none";

  // Refresh chat state
  resetCurrentChat();
}
