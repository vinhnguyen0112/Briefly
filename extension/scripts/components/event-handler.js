import { elements } from "./dom-elements.js";
import {
  state,
  getConfig,
  saveConfig,
  resetCurrentChatState,
  setCurrentChatState,
  resetPaginationState,
  getUserSession,
} from "./state.js";
import {
  handleResize,
  stopResize,
  addMessageToChat,
  closeAllScreensAndPanels,
  switchToChat,
  handleContentMessage,
  clearMessagesFromMessageContainer,
  clearChatHistoryList,
  showToast,
  removeToast,
  updateToast,
  resetSuggestedQuestionsContainer,
} from "./ui-handler.js";
import { processUserQuery } from "./api-handler.js";
import {
  openNotesPanel,
  openNoteEditor,
  closeNoteEditor,
  handleSaveNote,
} from "./notes-handler.js";
import { switchLanguage, translateElement } from "./i18n.js";
import idbHandler from "./idb-handler.js";
import chatHandler from "./chat-handler.js";
import { updateContentStatus } from "./content-handler.js";

// wires up all the event listeners in the app
export function setupEventListeners() {
  elements.closeSidebarButton.addEventListener("click", () => {
    window.parent.postMessage({ action: "close_sidebar" }, "*");
  });

  // Title click
  elements.titleContainer.addEventListener("click", () => {
    closeAllScreensAndPanels();

    // Scroll to bottom of chat
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
  });

  setupAuthenticationButtons();

  setupQuickActionsEvent();

  elements.configButton.addEventListener("click", () => {
    if (state.isConfigOpen) {
      closeAllScreensAndPanels();
    } else {
      closeAllScreensAndPanels();
      elements.chatScreen.style.display = "none";
      elements.configContainer.style.display = "flex";
      elements.configButton.classList.add("active");
      state.isConfigOpen = true;

      initializeConfigUI();
    }
  });

  elements.configCloseButton.addEventListener("click", () => {
    elements.configContainer.style.display = "none";
    elements.configButton.classList.remove("active");
    state.isConfigOpen = false;
    elements.chatScreen.style.display = "flex";
  });

  elements.resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    state.isResizing = true;
    elements.resizeHandle.classList.add("active");
    document.body.classList.add("sidebar-resizing");
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  });

  // Handle submit via Enter key
  elements.userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent newline
      const message = elements.userInput.value;
      handleSubmit(message);
    }
  });

  // Handle submit via button click
  elements.chatForm.addEventListener("submit", (e) => {
    e.preventDefault(); // prevent real form submission
    const message = elements.userInput.value;
    handleSubmit(message);
  });

  // Auto-grow textarea
  elements.userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.action) {
      handleContentMessage(event.data);
    }
  });

  elements.notesButton.addEventListener("click", () => {
    if (state.isNotesOpen) {
      elements.notesScreen.style.display = "none";
      elements.notesButton.classList.remove("active");
      state.isNotesOpen = false;

      elements.chatScreen.style.display = "flex";
    } else {
      closeAllScreensAndPanels();

      openNotesPanel();
      elements.notesButton.classList.add("active");
      state.isNotesOpen = true;
    }
  });

  elements.closeNotesButton.addEventListener("click", () => {
    elements.notesScreen.style.display = "none";
    elements.notesButton.classList.remove("active");
    state.isNotesOpen = false;

    elements.chatScreen.style.display = "flex";
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

    // const questionsContainer = document.querySelector(".generated-questions");
    // if (questionsContainer && questionsContainer.style.display !== "none") {
    //   const buttonContainer = document.querySelector(
    //     ".question-buttons-container"
    //   );
    //   if (buttonContainer) {
    //     buttonContainer.innerHTML = `
    //       <div class="question-loading">
    //         <div class="spinner-small"></div>
    //         <span data-i18n="generatingQuestions">
    //           ${
    //             language === "vi"
    //               ? "Đang tạo câu hỏi..."
    //               : "Generating questions..."
    //           }
    //         </span>
    //       </div>
    //     `;
    //   }
    // }

    // Use the new internationalization module to switch language
    switchLanguage(language).then((message) => {
      state.language = language;
      // Reset suggested questions when language change
      resetSuggestedQuestionsContainer();

      // Notify the user about language change
      addMessageToChat({ message, role: "assistant" });
    });
  });

  elements.closeSignInAlertButton.addEventListener(
    "click",
    closeSignInAlertPopup
  );

  elements.newChatButton.addEventListener("click", () => {
    resetCurrentChatState();
    closeAllScreensAndPanels();
    clearMessagesFromMessageContainer();
    switchToChat();
  });

  setupListenersForDynamicChatHistoryElements();

  // Hide menus when clicking outside
  document.addEventListener("click", () => {
    closeAllChatHistoryItemsMenu();
  });
}

let isSubmitting = false;

function handleSubmit(message) {
  if (isSubmitting || !message.trim()) return;
  isSubmitting = true;

  processUserQuery(message.trim()).finally(() => {
    isSubmitting = false;
  });

  elements.userInput.value = "";
  elements.userInput.style.height = "auto";
}

/**
 * Set up event listeners for quick action buttons.
 * @param {HTMLElement|Document} container Element to scope querySelector to
 */
export function setupQuickActionsEvent(container = document) {
  const quickActionButtons = container.querySelectorAll(".action-button");

  quickActionButtons.forEach((button) => {
    // Prevent multiple bindings
    if (button.dataset.bound === "true") return;

    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-action");
      let query = "";
      const metadata = {};

      switch (action) {
        case "summarize":
          query = "Summarize this page in a concise way.";
          metadata.event = "summarize";
          break;
        case "keypoints":
          query = "What are the key points of this page?";
          metadata.event = "keyPoints";
          break;
        case "explain":
          query = "Explain the content of this page as if I'm a beginner.";
          metadata.event = "explain";
          break;
        default:
          metadata.event = "ask";
      }

      if (query) {
        switchToChat();
        const response = await processUserQuery(query, metadata);
      }
    });
  });
}

function setupAuthenticationButtons() {
  // Google authentication button
  elements.googleLoginButtons.forEach((b) => {
    b.addEventListener("click", () => {
      const toastId = showToast({
        message:
          state.language === "en"
            ? "Signing in with Google..."
            : "Đang đăng nhập với Google...",
        type: "loading",
        duration: null,
      });
      chrome.runtime.sendMessage({ action: "google_login" }, (response) => {
        if (response.success) {
          closeAccountPopupUI();
          closeSignInAlertPopup();
          updateToast(toastId, {
            message:
              state.language === "en"
                ? "Signed in successfully"
                : "Đăng nhập thành công",
            type: "success",
            duration: 2000,
          });
        } else {
          updateToast(toastId, {
            message:
              state.language === "en"
                ? "Google sign-in failed"
                : "Đăng nhập Google thất bại",
            type: "error",
            duration: 2000,
          });
        }
      });
    });
  });

  // Facebook authentication button
  elements.facebookLoginButtons.forEach((b) => {
    b.addEventListener("click", () => {
      const toastId = showToast({
        message:
          state.language === "en"
            ? "Signing in with Facebook..."
            : "Đang đăng nhập với Facebook...",
        type: "loading",
        duration: null,
      });
      chrome.runtime.sendMessage({ action: "facebook_login" }, (response) => {
        if (response.success) {
          closeAccountPopupUI();
          closeSignInAlertPopup();
          updateToast(toastId, {
            message:
              state.language === "en"
                ? "Signed in successfully"
                : "Đăng nhập thành công",
            type: "success",
            duration: 2000,
          });
        } else {
          updateToast(toastId, {
            message:
              state.language === "en"
                ? "Facebook sign-in failed"
                : "Đăng nhập Facebook thất bại",
            type: "error",
            duration: 2000,
          });
        }
      });
    });
  });

  // Sign out button
  elements.signOutButton.addEventListener("click", () => {
    const toastId = showToast({
      message: state.language === "en" ? "Signing out..." : "Đang đăng xuất...",
      type: "loading",
      duration: null,
    });
    chrome.runtime.sendMessage({ action: "sign_out" }, (response) => {
      if (response.success) {
        closeAccountPopupUI();
        updateToast(toastId, {
          message:
            state.language === "en"
              ? "Signed out successfully"
              : "Đăng xuất thành công",
          type: "success",
          duration: 2000,
        });
      } else {
        updateToast(toastId, {
          message:
            state.language === "en" ? "Sign out failed" : "Đăng xuất thất bại",
          type: "error",
          duration: 2000,
        });
      }
    });
  });

  elements.accountButton.addEventListener("click", () =>
    toggleAccountPopupUI()
  );
}

/**
 * Initializes event listeners for dynamic chat history UI elements.
 */
export function setupListenersForDynamicChatHistoryElements() {
  if (state.isChatHistoryEventsInitialized) {
    console.log("Chat history event already initialized, returning");
    return;
  }

  // Query elements
  const chatHistoryButton = document.getElementById("chat-history-button");
  const chatHistoryContent = document.getElementById("chat-history-content");
  const clearChatHistoryButton = document.getElementById(
    "clear-chat-history-button"
  );
  const refreshChatHistoryButton = document.getElementById(
    "refresh-chat-history-button"
  );
  const closeChatHistoryButton = document.getElementById(
    "close-chat-history-button"
  );

  // Assign event handlers
  chatHistoryButton.addEventListener("click", toggleChatHistoryScreen);

  closeChatHistoryButton.addEventListener("click", () => {
    closeAllScreensAndPanels();
  });

  clearChatHistoryButton.addEventListener("click", () => {
    showClearChatHistoryDialog();
  });

  refreshChatHistoryButton.addEventListener(
    "click",
    refreshChatHistoryEventHandler
  );

  chatHistoryContent.addEventListener("scroll", chatHistoryScrollEventHandler);

  state.isChatHistoryEventsInitialized = true;
}

/**
 * Toggle display state of chat history screen
 */
function toggleChatHistoryScreen() {
  const chatHistory = elements.chatHistoryScreen;
  const chatHistoryButton = document.getElementById("chat-history-button");

  // Open
  if (chatHistory.style.display === "none" || !chatHistory.style.display) {
    closeAllScreensAndPanels();
    elements.chatScreen.style.display = "none";
    chatHistory.style.display = "flex";

    if (chatHistoryButton) {
      chatHistoryButton.classList.add("active");
    }

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
    closeAllScreensAndPanels();
    elements.chatScreen.style.display = "flex";
  }
}

/**
 * Shows a confirmation dialog to clear all chat history.
 */
function showClearChatHistoryDialog() {
  showPopupDialog({
    title: "Delete confirmation",
    message:
      "Do you want to clear all chat history? This action is irreversable",
    buttons: [
      {
        label: "Delete",
        style: "danger",
        eventHandler: clearChatHistoryEventHandler,
      },
    ],
  });
}

/**
 * Event handler for clear chat history
 */
function clearChatHistoryEventHandler() {
  // TODO: Refactor event handler to exclude current chat from deletion

  const toastId = showToast({
    message:
      state.language === "en"
        ? "Deleting all history"
        : "Đang xóa toàn bộ lịch sử",
    type: "loading",
    duration: null,
  });

  chrome.runtime.sendMessage({ action: "clear_chat_history" }, (response) => {
    if (response.success) {
      console.log("Briefly: Clear chat history successfully");
      state.chatHistory = [];
      renderAllChatHistory();

      // Reset current chat for now
      clearMessagesFromMessageContainer();
      resetCurrentChatState();

      updateToast(toastId, {
        message:
          state.language === "en" ? "Delete successfully" : "Xóa thành công",
        type: "success",
        duration: 2000,
      });
    } else {
      console.log("Briefly: Clear user history failed!");
      updateToast(toastId, {
        message: state.language === "en" ? "Delete failed" : "Xóa thất bại",
        type: "error",
        duration: 2000,
      });
    }
  });
}

/**
 * Event handler for refresh chat history action
 */
function refreshChatHistoryEventHandler() {
  if (state.pagination.isFetching) {
    console.log("Refresh locked");
    return;
  }
  // Empty out chat history UI, state and reset pagination state
  clearChatHistoryList();
  state.chatHistory = [];
  resetPaginationState();
  fetchChatHistory(); // Force fetch chat history
}

/**
 * Event handler for chat history infinite scroll action
 * @param {Event} e
 */
function chatHistoryScrollEventHandler(e) {
  const content = e.target;
  const { scrollTop, scrollHeight, clientHeight } = content;
  if (
    scrollTop + clientHeight >= scrollHeight - 100 &&
    !state.pagination.isFetching &&
    state.pagination.hasMore
  ) {
    fetchChatHistory();
  }
}

/**
 * Fetches chat history for the current page and updates UI.
 */
function fetchChatHistory() {
  console.log("Fetching chat history");
  state.pagination.isFetching = true;

  const { chatHistoryList } = elements;
  showFetchingChatHistorySpinner(chatHistoryList);

  chrome.runtime.sendMessage(
    {
      action: "fetch_chat_history",
      currentPage: state.pagination.currentPage,
    },
    async (response) => {
      mergeFetchedChats(response.chats);
      state.pagination.isFetching = false;
      state.pagination.hasMore = response.hasMore;

      removeChatHistorySpinner(chatHistoryList);
      renderCurrentPageChatHistory();
      state.pagination.currentPage += 1;
    }
  );
}

/**
 * Merges fetched chats into the current chat history state.
 * @param {Array} chats
 */
function mergeFetchedChats(chats) {
  const fetchedChats = new Map(
    chats.map((chat) => [
      chat.id,
      {
        id: chat.id,
        title: chat.title,
        page_url: chat.page_url,
        page_id: chat.page_id,
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
}

/**
 * Shows a loading spinner in the chat history list during fetches.
 * @param {HTMLElement} chatHistoryList
 */
function showFetchingChatHistorySpinner(chatHistoryList) {
  if (!chatHistoryList) return;
  let spinner = chatHistoryList.querySelector(".chat-history-spinner");
  if (spinner) spinner.remove();
  spinner = document.createElement("div");
  spinner.className = "chat-history-spinner";
  spinner.innerHTML = `
    <div class="spinner" style="margin: 24px auto;"></div>
    <div style="text-align:center;color:#888;font-size:14px;margin-top:8px;">Fetching chat history...</div>
  `;
  chatHistoryList.appendChild(spinner);
}

/**
 * Removes the loading spinner from the chat history list.
 * @param {HTMLElement} chatHistoryList
 */
function removeChatHistorySpinner(chatHistoryList) {
  const spinner = chatHistoryList?.querySelector(".chat-history-spinner");
  if (spinner) spinner.remove();
}

/**
 * Renders the chat history of the current page
 */
function renderCurrentPageChatHistory() {
  const LIMIT = 20;
  const { chatHistoryList, chatHistoryEmpty } = elements;
  if (!chatHistoryList) return;

  try {
    if (!state.chatHistory || state.chatHistory.length === 0) {
      chatHistoryEmpty.style.display = "block";
      return;
    }
    chatHistoryEmpty.style.display = "none";
    const startIdx = state.pagination.currentPage * LIMIT;
    const endIdx = startIdx + LIMIT;
    const chatsToRender = state.chatHistory.slice(startIdx, endIdx);
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

/**
 * Renders all chat history from stored state.
 */
function renderAllChatHistory() {
  const { chatHistoryList, chatHistoryEmpty } = elements;
  if (!chatHistoryList) return;

  try {
    if (!state.chatHistory || state.chatHistory.length === 0) {
      chatHistoryEmpty.style.display = "block";
      chatHistoryList.innerHTML = "";
      return;
    }
    chatHistoryEmpty.style.display = "none";
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

/**
 * Creates a chat history item DOM element with all event handlers.
 * @param {Object} chat
 * @returns {HTMLElement}
 */
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
      <button class="chat-history-actions-menu-item button" id="rename-button">
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.779 17.779 4.36 19.918 6.5 13.5m4.279 4.279 8.364-8.643a3.027 3.027 0 0 0-2.14-5.165 3.03 3.03 0 0 0-2.14.886L6.5 13.5m4.279 4.279L6.499 13.5m2.14 2.14 6.213-6.504M12.75 7.04 17 11.28"/>
        </svg>
        <span data-i18n="rename">Rename<span/>
      </button>
      <button class="chat-history-actions-menu-item button" id="delete-button" style="color:#E53E3E">
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
        </svg>
        <span data-i18n="delete">Delete<span/>
      </button>
    </div>
  `;

  translateElement(item);

  item.addEventListener("click", (e) =>
    handleChatHistoryItemClick(e, chat, item)
  );
  setupChatHistoryActions(item, chat);

  return item;
}

/**
 * Handles click on a chat history item (excluding menu/actions).
 * @param {Event} e
 * @param {Object} chat
 * @param {HTMLElement} item
 */
async function handleChatHistoryItemClick(e, chat, item) {
  console.log("Chat history item clicked:", chat);
  if (
    e.target.closest(".chat-history-actions-menu") ||
    e.target.classList.contains("chat-history-actions-button") ||
    e.target.classList.contains("chat-history-title-input")
  ) {
    return;
  }
  // UI tasks
  clearMessagesFromMessageContainer();
  closeAllScreensAndPanels();
  switchToChat();
  resetSuggestedQuestionsContainer();

  let messages = [];
  if (navigator.onLine) {
    // Fetch and display messages
    const fetchMessageResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "fetch_chat_messages", chatId: chat.id },
        (res) => resolve(res || {})
      );
    });
    messages = fetchMessageResponse.messages || [];
    const found = await idbHandler.getChatById(chat.id);
    if (!found) await idbHandler.upsertChat(chat);
    await idbHandler.overwriteChatMessages(chat.id, messages);

    // Fetch original page content
    const getPageResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "get_page", page_id: chat.page_id },
        (res) => resolve(res || {})
      );
    });

    // Set original page content
    if (getPageResponse.success) {
      console.log("Page fetched, content: ", getPageResponse.page);
      state.chatHistoryPageContent = getPageResponse.page.page_content;
    }

    state.isViewChatHistory = true;
  } else {
    messages = await idbHandler.getMessagesForChat(chat.id);
  }

  const history = [];
  for (const message of messages) {
    addMessageToChat({
      message: message.content,
      role: message.role,
      messageId: message.id,
    });
    history.push({ role: message.role, content: message.content });
  }
  setCurrentChatState({ ...chat, history });
}

/**
 * Sets up actions for a chat history item.
 * @param {HTMLElement} item
 * @param {Object} chat
 */
function setupChatHistoryActions(item, chat) {
  const actionsBtn = item.querySelector(".chat-history-actions-button");
  const menu = item.querySelector(".chat-history-actions-menu");

  // Open menu
  actionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleChatHistoryMenu(menu);
  });

  // Rename
  item.querySelector("#rename-button").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.add("hidden");
    showRenameChatInput(item, chat);
  });

  // Delete
  item.querySelector("#delete-button").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.add("hidden");
    showDeleteChatDialog(chat);
  });
}

/**
 * Toggles the visibility of a chat history item's menu, closing others.
 * @param {HTMLElement} menu
 */
function toggleChatHistoryMenu(menu) {
  const isHidden = menu.classList.contains("hidden");
  closeAllChatHistoryItemsMenu(menu);
  menu.classList.toggle("hidden", !isHidden);

  // Optionally add positioning logic here if needed
}

/**
 * Shows an input for renaming a chat and handles save/cancel.
 * @param {HTMLElement} item
 * @param {Object} chat
 */
function showRenameChatInput(item, chat) {
  const titleDiv = item.querySelector(".chat-history-title");
  const currentTitle = titleDiv.textContent.trim();
  titleDiv.outerHTML = `<input type="text" class="chat-history-title-input" value="${currentTitle}" />`;
  const input = item.querySelector(".chat-history-title-input");
  input.focus();
  input.select();

  let isRenaming = false; // Spam lock

  const save = async () => {
    if (isRenaming) return;
    isRenaming = true;

    const newTitle = input.value.trim();
    // If user actually gave a new name
    if (newTitle && newTitle !== currentTitle) {
      // Show toast
      const toastId = showToast({
        message: state.language === "en" ? "Renaming chat" : "Đang sửa tên",
        type: "loading",
        duration: null,
      });
      try {
        await chatHandler.updateChat(chat.id, { title: newTitle });
        await idbHandler.updateChat(chat.id, { title: newTitle });
        state.chatHistory = state.chatHistory.map((c) =>
          c.id === chat.id ? { ...c, title: newTitle } : c
        );

        // Update toast to display success
        updateToast(toastId, {
          message:
            state.language === "en"
              ? "Rename successfully"
              : "Sửa tên thành công",
          type: "success",
          duration: 2000,
        });
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
        isRenaming = false;
        return;
      }
    }

    input.outerHTML = `<div class="chat-history-title">${
      newTitle || currentTitle
    }</div>`;
    isRenaming = false;
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
    else if (e.key === "Escape") {
      input.outerHTML = `<div class="chat-history-title">${currentTitle}</div>`;
    }
  });
  input.addEventListener("blur", save);
}

/**
 * Shows a confirmation dialog to delete a single chat.
 * @param {Object} chat
 */
function showDeleteChatDialog(chat) {
  showPopupDialog({
    title: "Confirmation",
    message: "Are you sure you want to delete this chat?",
    buttons: [
      {
        label: "Yes",
        style: "danger",
        eventHandler: async () => {
          const toastId = showToast({
            message: state.language === "en" ? "Deleting chat" : "Đang xóa",
            type: "loading",
            duration: null,
          });
          try {
            await chatHandler.deleteChatById(chat.id);
            await idbHandler.deleteChatById(chat.id);
            state.chatHistory = state.chatHistory.filter(
              (c) => c.id !== chat.id
            );
            removeChatHistoryItem(chat.id);
            if (chat.id === state.currentChat.id) {
              clearMessagesFromMessageContainer();
              resetCurrentChatState();
            }

            updateToast(toastId, {
              message:
                state.language === "en"
                  ? "Chat deleted sucessfully"
                  : "Xóa thành công",
              type: "success",
              duration: 2000,
            });
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
          }
        },
      },
      { label: "No", style: "secondary" },
    ],
  });
}

/**
 * Closes all chat history action menus except the provided one.
 * @param {HTMLElement|null} except
 */
export function closeAllChatHistoryItemsMenu(except = null) {
  document.querySelectorAll(".chat-history-actions-menu").forEach((el) => {
    if (el !== except) el.classList.add("hidden");
  });
}

/**
 * Removes a chat history item
 * @param {string} id
 */
function removeChatHistoryItem(id) {
  const itemToRemove = document.querySelector(`[data-chat-id="${id}"]`);
  elements.chatHistoryList.removeChild(itemToRemove);
}

/**
 * Closes the chat history screen.
 */
export function closeChatHistoryScreen() {
  elements.chatHistoryScreen.style.display = "none";
}

/**
 * @typedef {Object} PopupButton
 * @property {string} label The button label text
 * @property {"primary" | "secondary" | "danger" | "warning" | "confirm"} style Visual style of the button
 * @property {Function} [eventHandler] Function to execute when the button is clicked
 */
/**
 * Create and display a popup dialog with a title, optional message, and buttons.
 *
 * A close button is created by default
 *
 * @param {Object} options Configuration for the popup
 * @param {string} options.title The popup title
 * @param {string} options.message The optional message content
 * @param {Array<PopupButton>} options.buttons Array of buttons to display
 */
export function showPopupDialog(options) {
  const { title, message, buttons = [] } = options;

  // Create overlay
  const dialogOverlay = document.createElement("div");
  dialogOverlay.className = "dynamic-dialog-overlay overlay";

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
      dialogOverlay.remove();
    };
    content.appendChild(button);
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "button button-secondary";
  closeBtn.textContent = "Close";
  closeBtn.style.width = "100%";
  closeBtn.onclick = () => dialogOverlay.remove();
  content.appendChild(closeBtn);

  popup.appendChild(content);
  dialogOverlay.appendChild(popup);

  document.body.appendChild(dialogOverlay);
}

/**
 * Displays a popup alert dialog with a title, message, icon, and a close (×) button.
 * The icon and color are set based on the `type` param.
 *
 * @param {Object} options
 * @param {string} options.title The alert title text.
 * @param {string} options.message The alert message content.
 * @param {string} options.buttonLabel The close button label.
 * @param {'success'|'error'|'warning'|'info'} [options.type] The alert type.
 */
export function showPopupAlert({
  title,
  message,
  type = "info",
  buttonLabel = "Close",
}) {
  const ICONS = {
    success: {
      svg: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#27ae60"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 12l2.5 2.5L16 9"/></svg>`,
      color: "#27ae60",
    },
    error: {
      svg: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#e74c3c"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M15 9l-6 6m0-6l6 6"/></svg>`,
      color: "#e74c3c",
    },
    warning: {
      svg: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#f39c12"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M12 8v4m0 4h.01"/></svg>`,
      color: "#f39c12",
    },
    info: {
      svg: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#3498db"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M12 8h.01M12 12v4"/></svg>`,
      color: "#3498db",
    },
  };

  const icon = ICONS[type] || ICONS.info;

  const alertOverlay = document.createElement("div");
  alertOverlay.className = "dynamic-alert-overlay overlay";

  const popup = document.createElement("div");
  popup.className = "alert-popup";

  const iconWrapper = document.createElement("div");
  iconWrapper.className = "alert-popup-icon";
  iconWrapper.innerHTML = icon.svg;
  popup.appendChild(iconWrapper);

  const content = document.createElement("div");
  content.className = "popup-content";

  const titleElement = document.createElement("h3");
  titleElement.className = "popup-title";
  titleElement.textContent = title;
  titleElement.style.color = icon.color;
  content.appendChild(titleElement);

  if (message) {
    const messageElement = document.createElement("p");
    messageElement.className = "popup-message";
    messageElement.textContent = message;
    content.appendChild(messageElement);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "button button-secondary";
  closeBtn.textContent = buttonLabel;
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.onclick = () => alertOverlay.remove();
  content.appendChild(closeBtn);

  popup.appendChild(content);
  alertOverlay.appendChild(popup);
  document.body.appendChild(alertOverlay);
}

/**
 * Toggle the account popup display state (show/hide)
 */
function toggleAccountPopupUI() {
  const { accountPopup, accountButton } = elements;
  // Show
  if (accountPopup.style.display === "none" || !accountPopup.style.display) {
    // Get button position
    const rect = accountButton.getBoundingClientRect();
    // Set accountPopup position just below the button, aligned right edge
    accountPopup.style.top = `${rect.bottom + window.scrollY + 4}px`;
    accountPopup.style.right = `${
      window.innerWidth - rect.right - window.scrollX - 16
    }px`; // Offset by 16 pixels
    accountPopup.style.display = "block";
  }
  // Hide
  else {
    accountPopup.style.display = "none";
  }
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

export function showSignInAlertPopup() {
  elements.signInAlertOverlay.style.display = "flex";
}

function closeSignInAlertPopup() {
  elements.signInAlertOverlay.style.display = "none";
}

function createSliderMarkers(min, max, step) {
  const markerContainer = document.getElementById("slider-markers");
  markerContainer.innerHTML = ""; // Clear existing

  const totalSteps = (max - min) / step;
  const values = [min, min + (max - min) / 3, min + ((max - min) * 2) / 3, max];

  values.forEach((val) => {
    const marker = document.createElement("span");
    marker.textContent = val;
    marker.style.position = "absolute";
    marker.style.left = `${((val - min) / (max - min)) * 100}%`;
    marker.style.transform = "translateX(-50%)";
    markerContainer.appendChild(marker);
  });
}

function initializeConfigUI() {
  getConfig().then((config) => {
    const maxWordCount = config?.maxWordCount || 150;
    const responseStyle = config?.responseStyle || "conversational";

    createSliderMarkers(50, 500, 10);

    const slider = document.getElementById("max-word-count");
    const wordCountValue = document.getElementById("word-count-value");
    slider.value = maxWordCount;
    wordCountValue.textContent = maxWordCount;

    slider.addEventListener("input", () => {
      wordCountValue.textContent = slider.value;
    });

    // Set selected response style
    const radioInputs = document.querySelectorAll(
      'input[name="response-style"]'
    );
    radioInputs.forEach((input) => {
      input.checked = input.value === responseStyle;
      input.closest(".radio-card").classList.toggle("selected", input.checked);
    });

    // Update selection visuals on click
    document.querySelectorAll(".radio-card").forEach((card) => {
      card.addEventListener("click", () => {
        const radio = card.querySelector('input[type="radio"]');
        radio.checked = true;
        document
          .querySelectorAll(".radio-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    document.getElementById("save-config").addEventListener("click", () => {
      const newWordCount = parseInt(slider.value);
      const selectedStyle = document.querySelector(
        'input[name="response-style"]:checked'
      )?.value;

      const newConfig = {
        ...config,
        personality: "Be helpful and informative, focusing on the content.",
        maxWordCount: newWordCount,
        responseStyle: selectedStyle,
      };

      saveConfig(newConfig).then(() => {
        state.currentConfig = newConfig;
        elements.configContainer.style.display = "none";
        elements.configButton.classList.remove("active");
        state.isConfigOpen = false;
        elements.chatScreen.style.display = "flex";

        addMessageToChat({
          message: "Settings updated! I'll use these for future responses.",
          role: "assistant",
        });
      });
    });
  });
}

// External function for rendering UI config
// function renderConfigUI(containerId, onSave) {
//   const container = document.getElementById(containerId);

//   if (!container) {
//     console.error("CocBot: Config container not found");
//     return;
//   }

//   getConfig().then((config) => {
//     const maxWordCount = config?.maxWordCount || 150;
//     const responseStyle = config?.responseStyle || "conversational";

//     container.innerHTML = `
//   <div class="config-section">
//     <div class="config-form">
//       <div class="form-group">
//         <label for="max-word-count" class="form-label">
//           <span data-i18n="responseLength">Maximum Response Length:</span>
//           <span id="word-count-value">${maxWordCount}</span>
//           <span data-i18n="words">words</span>
//         </label>
//         <div class="slider-container">
//           <input type="range" id="max-word-count" min="50" max="500" step="10" value="${maxWordCount}" class="slider">
//           <div class="slider-markers">
//             <span>50</span>
//             <span>150</span>
//             <span>300</span>
//             <span>500</span>
//           </div>
//         </div>
//         <div class="help-text" data-i18n="responseVerbosity">Control how verbose the answers will be</div>
//       </div>

//       <div class="form-group response-style-group">
//         <label class="form-label" data-i18n="responseStyle">Response Style:</label>
//         <div class="radio-options">
//           <label class="radio-card ${
//             responseStyle === "conversational" ? "selected" : ""
//           }" data-style="conversational">
//             <input type="radio" name="response-style" value="conversational" ${
//               responseStyle === "conversational" ? "checked" : ""
//             }>
//             <div class="radio-card-content">
//               <span class="radio-card-title" data-i18n="conversational">Conversational</span>
//               <span class="radio-card-desc" data-i18n="conversationalDesc">Friendly, easy-to-understand explanations using everyday language</span>
//             </div>
//           </label>
//           <label class="radio-card ${
//             responseStyle === "educational" ? "selected" : ""
//           }" data-style="educational">
//             <input type="radio" name="response-style" value="educational" ${
//               responseStyle === "educational" ? "checked" : ""
//             }>
//             <div class="radio-card-content">
//               <span class="radio-card-title" data-i18n="educational">Educational</span>
//               <span class="radio-card-desc" data-i18n="educationalDesc">Structured explanations with clear points and examples</span>
//             </div>
//           </label>
//           <label class="radio-card ${
//             responseStyle === "technical" ? "selected" : ""
//           }" data-style="technical">
//             <input type="radio" name="response-style" value="technical" ${
//               responseStyle === "technical" ? "checked" : ""
//             }>
//             <div class="radio-card-content">
//               <span class="radio-card-title" data-i18n="technical">Technical</span>
//               <span class="radio-card-desc" data-i18n="technicalDesc">Precise terminology and thorough analysis for advanced understanding</span>
//             </div>
//           </label>
//         </div>
//       </div>

//       <div class="form-actions">
//         <button id="save-config" type="button" class="btn-primary" data-i18n="saveSettings">Save Settings</button>
//       </div>
//     </div>
//   </div>
// `;

//     // Update word count display as slider changes
//     const slider = document.getElementById("max-word-count");
//     const wordCountValue = document.getElementById("word-count-value");

//     slider.addEventListener("input", () => {
//       wordCountValue.textContent = slider.value;
//     });

//     // Highlight selected radio card
//     const radioCards = document.querySelectorAll(".radio-card");
//     radioCards.forEach((card) => {
//       card.addEventListener("click", () => {
//         // Select the radio input
//         const radioInput = card.querySelector('input[type="radio"]');
//         radioInput.checked = true;

//         // Update visual selection
//         radioCards.forEach((c) => c.classList.remove("selected"));
//         card.classList.add("selected");
//       });
//     });

//     document.getElementById("save-config").addEventListener("click", () => {
//       const maxWordCount = parseInt(
//         document.getElementById("max-word-count").value
//       );
//       const responseStyle = document.querySelector(
//         'input[name="response-style"]:checked'
//       ).value;

//       // Use a default personality that aligns with the backend
//       const personality =
//         "Be helpful and informative, focusing on the content.";

//       const newConfig = {
//         ...config,
//         personality,
//         maxWordCount,
//         responseStyle,
//       };

//       saveConfig(newConfig).then(() => {
//         if (onSave) onSave(newConfig);
//       });
//     });
//   });
// }
