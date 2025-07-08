import { elements } from "./dom-elements.js";
import {
  state,
  getApiKey,
  saveApiKey,
  getConfig,
  saveConfig,
  getLanguage,
  saveLanguage,
  resetCurrentChatState,
  setCurrentChatState,
  addToScreenStack,
} from "./state.js";
import {
  handleResize,
  stopResize,
  addMessageToChat,
  addTypingIndicator,
  removeTypingIndicator,
  closeAllPanels,
  switchToChat,
  handleContentMessage,
  clearMessagesFromChat,
  updateFeedbackIconsForAssistantMessages,
  removeFeedbackIconsForAssistantMessages,
} from "./ui-handler.js";
import {
  requestPageContent,
  openContentViewerPopup,
  renderContentInSidebar,
  setupContentExtractionReliability,
} from "./content-handler.js";
import {
  callOpenAI,
  constructPromptWithPageContent,
  processUserQuery,
} from "./api-handler.js";
import {
  openNotesPanel,
  openNoteEditor,
  closeNoteEditor,
  handleSaveNote,
} from "./notes-handler.js";
import { switchLanguage } from "./i18n.js";
import idbHandler from "./idb-handler.js";
import chatHandler from "./chat-handler.js";

// wires up all the event listeners in the app
export function setupEventListeners() {
  elements.closeSidebarButton.addEventListener("click", () => {
    window.parent.postMessage({ action: "close_sidebar" }, "*");
  });

  // CocBot title click to return to welcome screen
  elements.cocbotTitle.addEventListener("click", () => {
    elements.chatScreen.style.display = "none";
    elements.chatHistoryScreen.style.display = "none";
    elements.contentViewerScreen.style.display = "none";
    elements.configContainer.style.display = "none";
    elements.apiKeyContainer.style.display = "none";
    elements.notesScreen.style.display = "none";

    elements.configButton.classList.remove("active");
    elements.settingsButton.classList.remove("active");
    elements.viewContentButton.classList.remove("active");
    elements.notesButton.classList.remove("active");

    elements.welcomeScreen.style.display = "flex";
    state.welcomeMode = true;

    state.screenStack = []; // Reset screen stack
  });

  setupAuthenticationButtons();

  setupQuickActions();

  elements.viewContentButton.addEventListener("click", () => {
    // Close content viewer
    if (state.isContentViewerOpen) {
      elements.contentViewerScreen.style.display = "none";
      elements.viewContentButton.classList.remove("active");
      state.isContentViewerOpen = false;

      // If still in welcome mode, show welcome screen
      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = "flex";
      }
      // Show chat screen if not in welcome mode
      else {
        elements.chatScreen.style.display = "flex";
      }
    }
    // Close all other panels and open content viewer
    else {
      closeAllPanels();

      openContentViewerPopup();
      elements.viewContentButton.classList.add("active");
      state.isContentViewerOpen = true;
    }
  });

  elements.saveApiKeyButton.addEventListener("click", () => {
    const apiKey = elements.apiKeyInput.value.trim();
    if (apiKey) {
      saveApiKey(apiKey).then(() => {
        console.log("CocBot: API key saved");
        elements.apiKeyContainer.style.display = "none";
        elements.settingsButton.classList.remove("active");
        state.isSettingsOpen = false;
      });
    }
  });

  elements.settingsButton.addEventListener("click", () => {
    if (state.isSettingsOpen) {
      elements.apiKeyContainer.style.display = "none";
      elements.settingsButton.classList.remove("active");
      state.isSettingsOpen = false;

      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = "flex";
      } else {
        elements.chatScreen.style.display = "flex";
      }
    } else {
      closeAllPanels();

      elements.apiKeyContainer.style.display = "flex";
      elements.settingsButton.classList.add("active");
      state.isSettingsOpen = true;
    }
  });

  elements.configButton.addEventListener("click", () => {
    if (state.isConfigOpen) {
      elements.configContainer.style.display = "none";
      elements.configButton.classList.remove("active");
      state.isConfigOpen = false;

      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = "flex";
      } else {
        elements.chatScreen.style.display = "flex";
      }
    } else {
      closeAllPanels();

      elements.configContainer.style.display = "block";
      elements.configButton.classList.add("active");
      state.isConfigOpen = true;

      renderConfigUI("config-content", (newConfig) => {
        state.currentConfig = newConfig;
        elements.configContainer.style.display = "none";
        elements.configButton.classList.remove("active");
        state.isConfigOpen = false;
        addMessageToChat(
          "Settings updated! I'll use these for future responses.",
          "assistant"
        );
      });
    }
  });

  elements.configCloseButton.addEventListener("click", () => {
    elements.configContainer.style.display = "none";
    elements.configButton.classList.remove("active");
    state.isConfigOpen = false;

    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = "flex";
    } else {
      elements.chatScreen.style.display = "flex";
    }
  });

  elements.resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    state.isResizing = true;
    elements.resizeHandle.classList.add("active");
    document.body.classList.add("sidebar-resizing");
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  });

  elements.welcomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = elements.welcomeInput.value.trim();
    if (!query) return;

    switchToChat();

    processUserQuery(query);

    elements.welcomeInput.value = "";
  });

  elements.welcomeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();

      const query = elements.welcomeInput.value.trim();
      if (query) {
        switchToChat();
        processUserQuery(query);
        elements.welcomeInput.value = "";
      }
    }
  });

  elements.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = elements.userInput.value.trim();
    if (!message) return;

    processUserQuery(message);

    elements.userInput.value = "";
    elements.userInput.style.height = "auto";
  });

  elements.userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  elements.userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const message = elements.userInput.value.trim();
      if (message) {
        processUserQuery(message);
        elements.userInput.value = "";
        elements.userInput.style.height = "auto";
      }
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.action) {
      handleContentMessage(event.data);
    }
  });

  elements.refreshContentButton.addEventListener("click", () => {
    requestPageContent();

    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-loading">
        <div class="spinner"></div>
        <p>Refreshing page content...</p>
      </div>
    `;
  });

  elements.closeContentButton.addEventListener("click", () => {
    elements.contentViewerScreen.style.display = "none";
    elements.viewContentButton.classList.remove("active");
    state.isContentViewerOpen = false;

    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = "flex";
    } else {
      elements.chatScreen.style.display = "flex";
    }
  });

  elements.notesButton.addEventListener("click", () => {
    if (state.isNotesOpen) {
      elements.notesScreen.style.display = "none";
      elements.notesButton.classList.remove("active");
      state.isNotesOpen = false;

      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = "flex";
      } else {
        elements.chatScreen.style.display = "flex";
      }
    } else {
      closeAllPanels();

      openNotesPanel();
      elements.notesButton.classList.add("active");
      state.isNotesOpen = true;
    }
  });

  elements.closeNotesButton.addEventListener("click", () => {
    elements.notesScreen.style.display = "none";
    elements.notesButton.classList.remove("active");
    state.isNotesOpen = false;

    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = "flex";
    } else {
      elements.chatScreen.style.display = "flex";
    }
  });

  elements.addNoteButton.addEventListener("click", () => {
    openNoteEditor();
  });

  elements.createFirstNoteButton.addEventListener("click", () => {
    openNoteEditor();
  });

  elements.saveNoteButton.addEventListener("click", () => {
    handleSaveNote();
  });

  elements.cancelNoteButton.addEventListener("click", () => {
    closeNoteEditor();
  });

  elements.closeEditorButton.addEventListener("click", () => {
    closeNoteEditor();
  });

  // language toggle
  elements.languageToggle?.addEventListener("change", (e) => {
    const language = e.target.checked ? "vi" : "en";

    const enLabel = document.getElementById("en-label");
    const viLabel = document.getElementById("vi-label");

    if (enLabel && viLabel) {
      enLabel.classList.toggle("active", language === "en");
      viLabel.classList.toggle("active", language === "vi");
    }

    const questionsContainer = document.querySelector(".generated-questions");
    if (questionsContainer && questionsContainer.style.display !== "none") {
      const buttonContainer = document.querySelector(
        ".question-buttons-container"
      );
      if (buttonContainer) {
        buttonContainer.innerHTML = `
          <div class="question-loading">
            <div class="spinner-small"></div>
            <span data-i18n="generatingQuestions">
              ${
                language === "vi"
                  ? "Đang tạo câu hỏi..."
                  : "Generating questions..."
              }
            </span>
          </div>
        `;
      }
    }

    // Use the new internationalization module to switch language
    switchLanguage(language).then((message) => {
      state.language = language;
      // Notify the user about language change
      addMessageToChat(message, "assistant");
    });
  });

  elements.closeSignInAlertButton.addEventListener(
    "click",
    closeSignInAlertPopup
  );

  elements.newChatButton.addEventListener("click", () => {
    resetCurrentChatState();
    clearMessagesFromChat();
    switchToChat();
  });

  setupListenersForDynamicChatHistoryElements();

  // TODO: Add event listeners
  elements.clearChatHistoryButton.addEventListener("click");

  elements.refreshChatHistoryButton
    .addEventListener("click")

    // Hide menus when clicking outside
    .document.addEventListener("click", () => {
      closeAllChatHistoryItemsMenu();
    });
}

export function setupListenersForDynamicChatHistoryElements() {
  if (state.isChatHistoryEventsInitialized) {
    console.log("Chat history event already initialized, returning");
    return;
  }
  console.log("Setting up chat history events");

  // Re-querying elements incase they are removed
  const chatHistoryButton = document.getElementById("chat-history-button");
  const chatHistoryContent = document.getElementById("chat-history-content");
  const closeChatHistoryButton = document.getElementById(
    "close-chat-history-button"
  );

  chatHistoryButton.removeEventListener("click");

  chatHistoryButton.addEventListener("click", (e) => {
    toggleChatHistoryScreen();
  });

  closeChatHistoryButton.addEventListener("click", (e) => {
    closeChatHistoryScreen();
    state.screenStack.pop();
  });

  // Chat history infinite scroll
  chatHistoryContent.addEventListener("scroll", (e) => {
    const { scrollTop, scrollHeight, clientHeight } = chatHistoryContent;

    if (
      scrollTop + clientHeight >= scrollHeight - 100 &&
      !state.pagination.isFetching &&
      state.pagination.hasMore
    ) {
      fetchChatHistory();
      return;
    }
  });

  state.isChatHistoryEventsInitialized = true;
}

// set up quick action buttons
function setupQuickActions() {
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
        switchToChat();
        processUserQuery(query);
      }
    });
  });
}

function setupAuthenticationButtons() {
  // Google authentication button
  elements.googleLoginButtons.forEach((b) => {
    b.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "google_login" }, (response) => {
        if (response.success) {
          // Close the account popup & sign in alert
          closeAccountPopupUI();
          closeSignInAlertPopup();
          console.log("User authenticated via Google");
          updateFeedbackIconsForAssistantMessages();
        }
      });
    });
  });

  // Facebook authentication button
  elements.facebookLoginButtons.forEach((b) => {
    b.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "facebook_login" }, (response) => {
        if (response.success) {
          // Close the account popup & sign in alert
          closeAccountPopupUI();
          closeSignInAlertPopup();
          console.log("User authenticated via Facebook");
          updateFeedbackIconsForAssistantMessages();
        }
      });
    });
  });

  // Sign out button
  elements.signOutButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "sign_out" }, (response) => {
      if (response.success) {
        // Close the account popup
        closeAccountPopupUI();

        console.log("User signed out");
        removeFeedbackIconsForAssistantMessages();
      }
    });
  });

  elements.accountButton.addEventListener("click", () =>
    toggleAccountPopupUI()
  );
}

// Close the account popup UI
function closeAccountPopupUI() {
  elements.accountPopup.style.display = "none";
}

// Render the account popup UI
export function renderToggleAccountPopupUI(isAuthenticated) {
  if (isAuthenticated) {
    elements.signOutButton.style.display = "flex";

    // Hide all Google and Facebook login buttons in the header
    elements.googleLoginButtons.forEach((button) => {
      if (button.classList.contains("header-button")) {
        button.style.display = "none";
      }
    });
    elements.facebookLoginButtons.forEach((button) => {
      if (button.classList.contains("header-button")) {
        button.style.display = "none";
      }
    });
  } else {
    elements.signOutButton.style.display = "none";

    // Show all Google and Facebook login buttons in the header
    elements.googleLoginButtons.forEach((button) => {
      if (button.classList.contains("header-button")) {
        button.style.display = "flex";
      }
    });
    elements.facebookLoginButtons.forEach((button) => {
      if (button.classList.contains("header-button")) {
        button.style.display = "flex";
      }
    });
  }
}

// Toggle the display state of the chat history screen
export function toggleChatHistoryScreen() {
  const chatHistory = elements.chatHistoryScreen;
  // Open
  if (chatHistory.style.display === "none" || !chatHistory.style.display) {
    chatHistory.style.display = "flex";
    addToScreenStack("history");
    // If first load
    if (
      state.pagination.currentPage === 0 &&
      !state.pagination.isFetching &&
      state.pagination.hasMore
    ) {
      fetchChatHistory();
    }
    // Else render all chat history incase of new chats
    else {
      console.log("Rendering all chat history");
      renderAllChatHistory();
    }
  }
  // Close
  else {
    chatHistory.style.display = "none";
    state.screenStack.pop();
  }

  console.log("Current stack: ", state.screenStack);
}

// Fetch chat history for the current page
export function fetchChatHistory() {
  console.log("Fetching chat history");
  state.pagination.isFetching = true;

  chrome.runtime.sendMessage(
    {
      action: "fetch_chat_history",
      currentPage: state.pagination.currentPage,
    },
    async (response) => {
      // Replace duplicated IDs with new chat
      const fetchedChats = new Map(
        response.chats.map((chat) => [
          chat.id,
          {
            id: chat.id,
            title: chat.title,
            page_url: chat.page_url,
            created_at: chat.created_at,
          },
        ])
      );

      const existingChats = new Map(
        state.chatHistory.map((chat) => [chat.id, chat])
      );

      for (const [id, newChat] of fetchedChats.entries()) {
        existingChats.set(id, newChat);
      }

      state.chatHistory = Array.from(existingChats.values());

      state.pagination.isFetching = false;
      state.pagination.hasMore = response.hasMore;

      console.log(
        `Fetched ${fetchedChats.length} chats: `,
        fetchedChats.values()
      );
      console.log("Has more chats: ", response.hasMore);

      // Render new chats
      renderCurrentPageChatHistory();

      state.pagination.currentPage += 1;
    }
  );
}

// Render chat history for the current page, for pagination
function renderCurrentPageChatHistory() {
  const LIMIT = 20;
  const { chatHistoryList, chatHistoryEmpty } = elements;

  if (!chatHistoryList) return;

  try {
    // If no chats, display 'no chats'
    if (!state.chatHistory || state.chatHistory.length === 0) {
      chatHistoryEmpty.style.display = "block";
      return;
    } else {
      // Hide 'no chats'
      chatHistoryEmpty.style.display = "none";
    }

    // Only render chats of current page
    const startIdx = state.pagination.currentPage * LIMIT;
    const endIdx = startIdx + LIMIT;
    const chatsToRender = state.chatHistory.slice(startIdx, endIdx);

    console.log("Chats to render: ", chatsToRender);

    chatsToRender.forEach((chat) => {
      const item = createChatHistoryItem(chat);
      chatHistoryList.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    chatHistoryList.innerHTML =
      "<div style='color:red'>Failed to load chat history.</div>";
    if (chatHistoryEmpty) chatHistoryEmpty.style.display = "none";
  }
}

// Render all chat history, for on chat history open
async function renderAllChatHistory() {
  const { chatHistoryList, chatHistoryEmpty } = elements;

  if (!chatHistoryList) return;

  try {
    if (!state.chatHistory || state.chatHistory.length === 0) {
      chatHistoryEmpty.style.display = "block";
      chatHistoryList.innerHTML = "";
      return;
    } else {
      chatHistoryEmpty.style.display = "none";
    }

    chatHistoryList.innerHTML = "";
    state.chatHistory.forEach((chat) => {
      const item = createChatHistoryItem(chat);
      chatHistoryList.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    chatHistoryList.innerHTML =
      "<div style='color:red'>Failed to load chat history.</div>";
    if (chatHistoryEmpty) chatHistoryEmpty.style.display = "none";
  }
}

// Create chat history item
function createChatHistoryItem(chat) {
  const item = document.createElement("div");
  item.className = "chat-history-item";
  item.setAttribute("data-chat-id", chat.id);
  item.innerHTML = `
    <div class="chat-history-header-row">
      <div class="chat-history-title">${chat.title}</div>
      <button class="chat-history-actions-button" title="More actions">⋯</button>
    </div>
    <div class="chat-history-meta">
      <span class="chat-history-url">${chat.page_url}</span>
      <span class="chat-history-date">${
        chat.created_at ? new Date(chat.created_at).toLocaleTimeString() : ""
      }</span>
    </div>
    <div class="chat-history-actions-menu hidden">
      <button class="chat-history-actions-menu-item button" id="rename-button" data-i18n="rename">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.779 17.779 4.36 19.918 6.5 13.5m4.279 4.279 8.364-8.643a3.027 3.027 0 0 0-2.14-5.165 3.03 3.03 0 0 0-2.14.886L6.5 13.5m4.279 4.279L6.499 13.5m2.14 2.14 6.213-6.504M12.75 7.04 17 11.28"/>
        </svg>Rename</button>
      <button class="chat-history-actions-menu-item button" id="delete-button" style="color:#E53E3E" data-i18n="delete">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="#E53E3E" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
        </svg>Delete</button>
    </div>
  `;

  // Open chat when click on chat history item
  item.addEventListener("click", async (e) => {
    if (
      e.target.closest(".chat-history-actions-menu") ||
      e.target.classList.contains("chat-history-actions-button") ||
      e.target.classList.contains("chat-history-title-input")
    )
      return;

    const history = [];
    clearMessagesFromChat();
    closeChatHistoryScreen();
    switchToChat();

    let messages;
    // If online
    if (navigator.onLine) {
      // Get messages from DB, default to empty
      messages = (await chatHandler.getMessages(chat.id)) || [];
      // Update IDB cache
      const found = await idbHandler.getChatById(chat.id);
      if (!found) await idbHandler.addChat(chat);
      await idbHandler.overwriteChatMessages(chat.id, messages);
    } else {
      messages = await idbHandler.getMessagesForChat(chat.id);
    }

    messages.forEach((message) => {
      addMessageToChat(message.content, message.role);
      history.push({ role: message.role, content: message.content });
    });

    // Set current chat
    setCurrentChatState({ ...chat, history });
  });

  setupChatHistoryActions(item, chat);

  return item;
}

function setupChatHistoryActions(item, chat) {
  const actionsBtn = item.querySelector(".chat-history-actions-button");
  const menu = item.querySelector(".chat-history-actions-menu");

  actionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const isHidden = menu.classList.contains("hidden");

    // Close all *other* menus, not this one
    closeAllChatHistoryItemsMenu(menu);

    if (isHidden) {
      menu.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
    }

    // Positioning logic
    if (!menu.classList.contains("hidden")) {
      const menuRect = menu.getBoundingClientRect();
      const buttonRect = actionsBtn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      if (spaceBelow < menuRect.height && spaceAbove > menuRect.height) {
        menu.style.top = `auto`;
        menu.style.bottom = `${spaceBelow}px`;
      } else {
        menu.style.top = "";
        menu.style.bottom = "";
      }
    } else {
      menu.style.top = "";
      menu.style.bottom = "";
    }
  });

  // Rename button handler
  item.querySelector("#rename-button").addEventListener("click", async (e) => {
    e.stopPropagation();
    menu.classList.add("hidden");

    const titleDiv = item.querySelector(".chat-history-title");
    const currentTitle = titleDiv.textContent.trim();
    titleDiv.outerHTML = `<input type="text" class="chat-history-title-input" value="${currentTitle}" />`;
    const input = item.querySelector(".chat-history-title-input");
    input.focus();
    input.select();

    const save = async () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        try {
          await chatHandler.updateChat(chat.id, { title: newTitle });
          await idbHandler.updateChat(chat.id, { title: newTitle });
          state.chatHistory = state.chatHistory.map((c) =>
            c.id === chat.id ? { ...c, title: newTitle } : c
          );
        } catch (err) {
          console.error(err);
          showPopupAlert({
            title: "Error",
            message: "Failed to update chat title. Please try again later",
          });
          return;
        }
      }
      input.outerHTML = `<div class="chat-history-title">${
        newTitle || currentTitle
      }</div>`;
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      else if (e.key === "Escape") {
        input.outerHTML = `<div class="chat-history-title">${currentTitle}</div>`;
      }
    });

    input.addEventListener("blur", save);
  });

  // Delete button handler
  item.querySelector("#delete-button").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.add("hidden");

    showPopupAlert({
      title: "Confirmation",
      message: "Are you sure you want to delete this chat?",
      buttons: [
        {
          label: "Yes",
          eventHandler: async () => {
            await chatHandler.deleteChat(chat.id);
            await idbHandler.deleteChat(chat.id);
            state.chatHistory = state.chatHistory.filter(
              (c) => c.id !== chat.id
            );
            removeChatHistoryItem(chat.id);
            // If deleted chat was current chat, reset current chat
            if (chat.id === state.currentChat.id) {
              clearMessagesFromChat();
              resetCurrentChatState();
            }
          },
        },
        {
          label: "No",
        },
      ],
    });
  });
}

// Helper to close all chat history action menus
export function closeAllChatHistoryItemsMenu(except = null) {
  document.querySelectorAll(".chat-history-actions-menu").forEach((el) => {
    if (el !== except) {
      el.classList.add("hidden");
    }
  });
}

function removeChatHistoryItem(id) {
  const itemToRemove = document.querySelector(`[data-chat-id="${id}"]`);
  elements.chatHistoryList.removeChild(itemToRemove);
}

export function closeChatHistoryScreen() {
  elements.chatHistoryScreen.style.display = "none";
}

// Create and popup a custom alert
export function showPopupAlert({ title, message = "", buttons = [] }) {
  // Create overlay
  const alertOverlay = document.createElement("div");
  alertOverlay.className = "dynamic-alert-overlay overlay";

  // Create popup
  const popup = document.createElement("div");
  popup.className = "alert-popup";

  // content
  const content = document.createElement("div");
  content.className = "popup-content";

  // title
  const titleElement = document.createElement("h3");
  titleElement.className = "popup-title";
  titleElement.textContent = title;
  content.appendChild(titleElement);

  // Message
  if (message) {
    const messageElement = document.createElement("p");
    messageElement.className = "popup-message";
    messageElement.textContent = message;
    content.appendChild(messageElement);
  }

  // Action buttons
  buttons.forEach((btn) => {
    const button = document.createElement("button");
    button.className = `button button-${btn.style}`;
    button.textContent = btn.label;
    button.style.width = "100%";
    button.style.marginBottom = "10px";
    button.onclick = (e) => {
      e.stopPropagation();
      if (typeof btn.eventHandler === "function") btn.eventHandler();
      alertOverlay.remove();
    };
    content.appendChild(button);
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "button button-secondary";
  closeBtn.textContent = "Close";
  closeBtn.style.width = "100%";

  closeBtn.onclick = () => {
    alertOverlay.remove();
  };

  // Appending
  content.appendChild(closeBtn);
  popup.appendChild(content);
  alertOverlay.appendChild(popup);

  document.body.appendChild(alertOverlay);
}

// Toggle on/off the account popup UI
function toggleAccountPopupUI() {
  const popup = elements.accountPopup;

  if (popup.style.display === "none" || !popup.style.display) {
    popup.style.display = "block";
  } else {
    popup.style.display = "none";
  }
}

export function showSignInAlertPopup() {
  elements.signInAlertOverlay.style.display = "flex";
}

function closeSignInAlertPopup() {
  elements.signInAlertOverlay.style.display = "none";
}

// External function for rendering UI config
function renderConfigUI(containerId, onSave) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error("CocBot: Config container not found");
    return;
  }

  getConfig().then((config) => {
    const maxWordCount = config?.maxWordCount || 150;
    const responseStyle = config?.responseStyle || "conversational";

    container.innerHTML = `
      <div class="config-section">
        <div class="config-form">
          <h3 class="config-title">Response Settings</h3>
          
          <div class="form-group">
            <label for="max-word-count" class="form-label">Maximum Response Length: <span id="word-count-value">${maxWordCount}</span> words</label>
            <div class="slider-container">
              <input type="range" id="max-word-count" min="50" max="500" step="10" value="${maxWordCount}" class="slider">
              <div class="slider-markers">
                <span>50</span>
                <span>150</span>
                <span>300</span>
                <span>500</span>
              </div>
            </div>
            <div class="help-text">Control how verbose the answers will be</div>
          </div>
          
          <div class="form-group response-style-group">
            <label class="form-label">Response Style:</label>
            <div class="radio-options">
              <label class="radio-card ${
                responseStyle === "conversational" ? "selected" : ""
              }" data-style="conversational">
                <input type="radio" name="response-style" value="conversational" ${
                  responseStyle === "conversational" ? "checked" : ""
                }>
                <div class="radio-card-content">
                  <span class="radio-card-title">Conversational</span>
                  <span class="radio-card-desc">Friendly, easy-to-understand explanations using everyday language</span>
                </div>
              </label>
              <label class="radio-card ${
                responseStyle === "educational" ? "selected" : ""
              }" data-style="educational">
                <input type="radio" name="response-style" value="educational" ${
                  responseStyle === "educational" ? "checked" : ""
                }>
                <div class="radio-card-content">
                  <span class="radio-card-title">Educational</span>
                  <span class="radio-card-desc">Structured explanations with clear points and examples</span>
                </div>
              </label>
              <label class="radio-card ${
                responseStyle === "technical" ? "selected" : ""
              }" data-style="technical">
                <input type="radio" name="response-style" value="technical" ${
                  responseStyle === "technical" ? "checked" : ""
                }>
                <div class="radio-card-content">
                  <span class="radio-card-title">Technical</span>
                  <span class="radio-card-desc">Precise terminology and thorough analysis for advanced understanding</span>
                </div>
              </label>
            </div>
          </div>
          
          <div class="form-actions">
            <button id="save-config" type="button" class="btn-primary">Save Settings</button>
          </div>
        </div>
      </div>
      
      <style>
        .config-section {
          padding: 1rem;
          background-color: var(--background-color, #ffffff);
          border-radius: 0.5rem;
          max-height: 85vh;
          overflow-y: auto;
        }
        .config-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: var(--text-color, #111827);
          text-align: center;
        }
        .config-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-color, #111827);
        }
        .help-text {
          font-size: 0.75rem;
          color: var(--muted-color, #6b7280);
          margin-top: 0.25rem;
        }
        .slider-container {
          padding: 0.5rem 0;
          margin: 0.5rem 0;
          position: relative;
        }
        .slider {
          appearance: none;
          width: 100%;
          height: 0.25rem;
          background: var(--border-color, #e5e7eb);
          border-radius: 1rem;
          margin: 0.5rem 0;
          outline: none;
          position: relative;
          z-index: 2;
        }
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 1rem;
          height: 1rem;
          background: var(--primary-color, #4a86e8);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          z-index: 3;
        }
        .slider::-webkit-slider-thumb:hover {
          background: var(--primary-hover, #3a76d8);
          transform: scale(1.1);
        }
        .slider-markers {
          display: flex;
          justify-content: space-between;
          width: calc(100% - 16px);
          font-size: 0.75rem;
          color: var(--muted-color, #6b7280);
          margin: 12px 8px 0 8px;
          position: relative;
          padding-top: 4px;
        }
        .slider-markers span:nth-child(1) {
          transform: translateX(0);
        }
        .slider-markers span:nth-child(4) {
          transform: translateX(0);
        }
        .response-style-group {
          margin-top: 1rem;
        }
        .radio-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.5rem;
        }
        .radio-card {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.75rem;
          border-radius: 0.375rem;
          border: 1px solid var(--border-color, #e5e7eb);
          background-color: var(--background-color, #ffffff);
          transition: all 0.2s ease;
        }
        .radio-card:hover {
          border-color: var(--border-hover, #d1d5db);
          background-color: var(--background-hover, #f9fafb);
        }
        .radio-card.selected {
          border-color: var(--primary-color, #4a86e8);
          background-color: var(--primary-light, #f0f7ff);
        }
        .radio-card input[type="radio"] {
          margin-top: 0.25rem;
        }
        .radio-card-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .radio-card-title {
          font-weight: 500;
          color: var(--text-color, #111827);
        }
        .radio-card-desc {
          font-size: 0.75rem;
          color: var(--muted-color, #6b7280);
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }
        .btn-primary {
          padding: 0.5rem 1rem;
          background-color: var(--primary-color, #4a86e8);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .btn-primary:hover {
          background-color: var(--primary-hover, #3a76d8);
        }
        .btn-primary:focus {
          outline: 2px solid var(--primary-light, #93c5fd);
          outline-offset: 2px;
        }
      </style>
    `;

    // Update word count display as slider changes
    const slider = document.getElementById("max-word-count");
    const wordCountValue = document.getElementById("word-count-value");

    slider.addEventListener("input", () => {
      wordCountValue.textContent = slider.value;
    });

    // Highlight selected radio card
    const radioCards = document.querySelectorAll(".radio-card");
    radioCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Select the radio input
        const radioInput = card.querySelector('input[type="radio"]');
        radioInput.checked = true;

        // Update visual selection
        radioCards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    document.getElementById("save-config").addEventListener("click", () => {
      const maxWordCount = parseInt(
        document.getElementById("max-word-count").value
      );
      const responseStyle = document.querySelector(
        'input[name="response-style"]:checked'
      ).value;

      // Use a default personality that aligns with the backend
      const personality =
        "Be helpful and informative, focusing on the content.";

      const newConfig = {
        ...config,
        personality,
        maxWordCount,
        responseStyle,
      };

      saveConfig(newConfig).then(() => {
        if (onSave) onSave(newConfig);
      });
    });
  });
}
