import { elements } from "./dom-elements.js";
import {
  state,
  getNotesForUrl,
  getAllNotes,
  getCurrentTabUrl,
  saveNote,
  updateNote,
  deleteNote,
  resetNotesPaginationState,
  getUserSession,
} from "./state.js";
import { translate, translateElement } from "./i18n.js";
import { escapeHtml, showToast, updateToast } from "./ui-handler.js";

let notesScrollListenerSetup = false;
let currentScrollHandler = null;
let originalContent = "";

const notesCacheState = {
  isInitialized: {
    current: false,
    all: false,
  },
  lastFetchTime: {
    current: null,
    all: null,
  },
  needsRefresh: {
    current: false,
    all: false,
  },
};

const notesScrollState = {
  current: 0,
  all: 0,
};

/**
 * Saves the current scroll position for the active notes tab
 * Used to maintain scroll position when switching between tabs or reloading content
 */
function saveScrollPosition() {
  const scrollableContainer = document.querySelector(".notes-content");
  if (scrollableContainer) {
    const currentTab = state.currentNotesTab;
    notesScrollState[currentTab] = scrollableContainer.scrollTop;
  }
}

/**
 * Restores the previously saved scroll position for the active notes tab
 * Executed after content loading is complete to maintain user's viewing position
 */
function restoreScrollPosition() {
  const scrollableContainer = document.querySelector(".notes-content");
  if (scrollableContainer) {
    const currentTab = state.currentNotesTab;
    const savedPosition = notesScrollState[currentTab] || 0;

    requestAnimationFrame(() => {
      scrollableContainer.scrollTop = savedPosition;
    });
  }
}

/**
 * Initializes and opens the notes panel interface
 * Handles authentication modal dismissal, screen switching, and initial content loading
 * Sets current page URL in global state for note creation context
 */
export async function openNotesPanel() {
  const currentUrl = await getCurrentTabUrl();
  state.currentPageUrl = currentUrl;

  const signInModal = document.querySelector("#sign-in-alert-overlay");
  if (signInModal) {
    signInModal.style.display = "none";
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.classList.remove("sign-in-blur");
  }

  if (elements.chatScreen) {
    elements.chatScreen.style.display = "none";
  }
  if (elements.notesScreen) {
    elements.notesScreen.style.display = "flex";
  }

  const currentContainer = document.querySelector("#notes-list-current");
  if (currentContainer) {
    showNotesLoadingSpinner(currentContainer, "current");
  }

  loadTabContent(false);
}

/**
 * Handles switching between "current page" and "all notes" tabs
 * Manages UI state updates, scroll position preservation, and content loading
 * Cleans up existing scroll listeners and sets up new ones for the active tab
 */
export function switchNotesTab(tabName) {
  saveScrollPosition();

  elements.notesTabCurrent.classList.toggle("active", tabName === "current");
  elements.notesTabAll.classList.toggle("active", tabName === "all");

  elements.notesTabCurrentContent.classList.toggle(
    "active",
    tabName === "current"
  );
  elements.notesTabAllContent.classList.toggle("active", tabName === "all");

  cleanupScrollListeners();

  state.currentNotesTab = tabName;

  const container = document.querySelector(
    tabName === "current" ? "#notes-list-current" : "#notes-list-all"
  );

  const needsFetch =
    !notesCacheState.isInitialized[tabName] ||
    notesCacheState.needsRefresh[tabName] ||
    state.notesData[tabName].length === 0;

  if (needsFetch && container) {
    showNotesLoadingSpinner(container, tabName);
  }

  loadTabContent(false).then(() => {
    restoreScrollPosition();
  });
}

/**
 * Displays a loading indicator for infinite scroll pagination
 * Shows a spinner at the bottom of the notes list when loading additional content
 * Removes any existing indicators to prevent duplicates
 */
function showNotesLoadMoreIndicator(container, tabType = "current") {
  if (!container) return;

  removeNotesLoadMoreIndicator(container);

  const loadMoreIndicator = document.createElement("div");
  loadMoreIndicator.className = "notes-load-more-indicator";

  const loadingText =
    state.language === "en"
      ? "Loading more notes..."
      : "Đang tải thêm ghi chú...";

  loadMoreIndicator.innerHTML = `
    <div class="load-more-spinner"></div>
    <div class="load-more-text">${loadingText}</div>
  `;

  container.appendChild(loadMoreIndicator);
}

/**
 * Removes the load more indicator from the notes container
 * Used when pagination loading is complete or encounters an error
 */
function removeNotesLoadMoreIndicator(container) {
  if (!container) return;

  const indicator = container.querySelector(".notes-load-more-indicator");
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Displays a loading spinner for initial notes loading
 * Clears container content and shows centered loading indicator with appropriate text
 * Hides empty state messages during loading process
 */
function showNotesLoadingSpinner(container, tabType = "current") {
  if (!container) return;

  removeNotesLoadingSpinner(container);

  const spinner = document.createElement("div");
  spinner.className = "notes-loading-spinner";

  const loadingText =
    state.language === "en" ? "Loading notes..." : "Đang tải ghi chú...";

  spinner.innerHTML = `
    <div class="spinner"></div>
    <div class="notes-loading-text">${loadingText}</div>
  `;

  container.innerHTML = "";
  container.appendChild(spinner);

  const emptyState = document.querySelector(`#notes-empty-state-${tabType}`);
  if (emptyState) {
    emptyState.style.display = "none";
  }
}

/**
 * Removes the loading spinner from the notes container
 * Called when content loading is complete or encounters an error
 */
function removeNotesLoadingSpinner(container) {
  if (!container) return;

  const spinner = container.querySelector(".notes-loading-spinner");
  if (spinner) {
    spinner.remove();
  }
}

/**
 * Orchestrates content loading for the currently active notes tab
 * Implements intelligent caching to avoid unnecessary API calls
 * Handles loading states and error fallbacks gracefully
 */
async function loadTabContent(forceRefresh = false) {
  const tab = state.currentNotesTab;

  if (state.notesPagination[tab].isFetching) {
    return Promise.resolve();
  }

  const shouldFetch =
    forceRefresh ||
    !notesCacheState.isInitialized[tab] ||
    notesCacheState.needsRefresh[tab] ||
    state.notesData[tab].length === 0;

  if (!shouldFetch) {
    if (tab === "current") {
      renderCurrentPageNotes(state.notesData.current);
    } else {
      renderAllNotes(state.notesData.all);
    }
    return Promise.resolve();
  }

  const container = document.querySelector(
    tab === "current" ? "#notes-list-current" : "#notes-list-all"
  );
  if (container) {
    showNotesLoadingSpinner(container, tab);
  }

  try {
    if (tab === "current") {
      await loadCurrentPageNotes(false);
    } else {
      await loadAllNotes(false);
    }

    notesCacheState.isInitialized[tab] = true;
    notesCacheState.lastFetchTime[tab] = Date.now();
    notesCacheState.needsRefresh[tab] = false;
  } catch (error) {
    console.error(`Error loading ${tab} notes:`, error);

    if (container) {
      removeNotesLoadingSpinner(container);
    }

    if (tab === "current") {
      renderCurrentPageNotes([]);
    } else {
      renderAllNotes([]);
    }
  }
}

/**
 * Initiates a manual refresh of the current notes tab
 * Resets pagination state and forces fresh data retrieval from the server
 * Displays loading indicator during the refresh process
 */
export function refreshNotes() {
  const tab = state.currentNotesTab;

  const container = document.querySelector(
    tab === "current" ? "#notes-list-current" : "#notes-list-all"
  );
  if (container) {
    showNotesLoadingSpinner(container, tab);
  }

  resetNotesPaginationState(tab);
  loadTabContent(true);
}

/**
 * Renders the notes list for the current page tab
 * Handles empty state display and sorts notes by creation timestamp
 * Sets up infinite scroll functionality after successful rendering
 */
function renderCurrentPageNotes(notes) {
  const container = document.querySelector("#notes-list-current");
  const emptyState = document.querySelector("#notes-empty-state-current");

  if (!container) {
    console.error("Notes container not found");
    return;
  }

  removeNotesLoadingSpinner(container);
  removeNotesLoadMoreIndicator(container);

  if (!notes || notes.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = "";

  // Sort notes by timestamp (newest first)
  notes.sort((a, b) => b.timestamp - a.timestamp);

  notes.forEach((note) => {
    const noteItem = createNoteItem(note, false);
    container.appendChild(noteItem);
  });

  setupNotesInfiniteScroll();
}

/**
 * Updates a note's content and timestamp in place without full page reload
 * Applies visual feedback animation and updates both UI and in-memory state
 * Operates on both current page and all notes containers simultaneously
 */
function updateNoteInPlace(noteId, newContent) {
  // Update both containers
  const containers = ["#notes-list-current", "#notes-list-all"];

  containers.forEach((selector) => {
    const container = document.querySelector(selector);
    if (!container) return;

    const noteElement = container.querySelector(`[data-id="${noteId}"]`);
    if (noteElement) {
      // Update the content display
      const contentElement = noteElement.querySelector(".note-content");
      if (contentElement) {
        contentElement.textContent = newContent;
      }

      // Update timestamp to "now"
      const metaElement = noteElement.querySelector(".note-meta span");
      if (metaElement) {
        const now = new Date();
        metaElement.textContent =
          now.toLocaleDateString() + " " + now.toLocaleTimeString();
      }
      noteElement.classList.add("note-updating");

      setTimeout(() => {
        noteElement.classList.remove("note-updating");
      }, 600); // Match CSS animation duration
    }
  });

  ["current", "all"].forEach((tab) => {
    const noteIndex = state.notesData[tab].findIndex(
      (note) => note.id === noteId
    );
    if (noteIndex !== -1) {
      state.notesData[tab][noteIndex].content = newContent;
      state.notesData[tab][noteIndex].timestamp = Date.now();
    }
  });
}

/**
 * Handles click events on note URLs to open them in new browser tabs
 * Validates URL format before attempting to create new tab
 * Prevents default link behavior to maintain extension context
 */
function handleUrlClick(e) {
  e.preventDefault();
  const url = e.target.textContent;
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    chrome.tabs.create({ url: url });
  }
}

/**
 * Removes a note from the UI with smooth animation
 * Updates both current page and all notes containers
 * Shows empty state if no notes remain after deletion
 */
function removeNoteInPlace(noteId) {
  // Remove from both containers
  const containers = ["#notes-list-current", "#notes-list-all"];

  containers.forEach((selector) => {
    const container = document.querySelector(selector);
    if (!container) return;

    const noteElement = container.querySelector(`[data-id="${noteId}"]`);
    if (noteElement) {
      noteElement.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      noteElement.style.opacity = "0";
      noteElement.style.transform = "translateX(-10px)";

      setTimeout(() => {
        noteElement.remove();

        const remainingNotes = container.children.length;
        if (remainingNotes === 0) {
          const tab = selector.includes("current") ? "current" : "all";
          const emptyState = document.querySelector(
            `#notes-empty-state-${tab}`
          );
          if (emptyState) {
            emptyState.style.display = "block";
          }
        }
      }, 300);
    }
  });

  ["current", "all"].forEach((tab) => {
    const noteIndex = state.notesData[tab].findIndex(
      (note) => note.id === noteId
    );
    if (noteIndex !== -1) {
      state.notesData[tab].splice(noteIndex, 1);
    }
  });
}

/**
 * Adds a new note to the UI with smooth entrance animation
 * Inserts at the beginning of the list to maintain chronological order
 * Hides empty state when adding the first note
 */
function addNoteInPlace(newNote) {
  const tab = state.currentNotesTab;
  const container = document.querySelector(
    tab === "current" ? "#notes-list-current" : "#notes-list-all"
  );
  const emptyState = document.querySelector(`#notes-empty-state-${tab}`);

  if (!container) return;

  if (emptyState && emptyState.style.display === "block") {
    emptyState.style.display = "none";
  }

  state.notesData[tab].unshift(newNote); // Add to beginning (newest first)

  const noteItem = createNoteItem(newNote, tab === "all");

  noteItem.style.opacity = "0";
  noteItem.style.transform = "translateY(-10px)";
  container.insertBefore(noteItem, container.firstChild);

  requestAnimationFrame(() => {
    noteItem.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    noteItem.style.opacity = "1";
    noteItem.style.transform = "translateY(0)";
  });
}

/**
 * Renders the complete notes list for the all notes tab
 * Handles empty state display and sets up infinite scroll
 * Displays all user notes regardless of source page
 */
function renderAllNotes(notes) {
  const container = document.querySelector("#notes-list-all");
  const emptyState = document.querySelector("#notes-empty-state-all");

  if (!container) {
    console.error("Notes container not found");
    return;
  }

  removeNotesLoadingSpinner(container);
  removeNotesLoadMoreIndicator(container);

  if (!notes || notes.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = "";

  notes.forEach((note) => {
    const noteItem = createNoteItem(note, true);
    container.appendChild(noteItem);
  });

  setupNotesInfiniteScroll();
}

let isSaving = false;
/**
 * Processes note save requests with comprehensive validation and feedback
 * Handles both new note creation and existing note updates
 * Provides real-time user feedback through toast notifications
 */
export async function handleSaveNote() {
  if (isSaving) {
    return;
  }

  isSaving = true;

  const content = elements.noteContent.value.trim();

  if (!content) {
    isSaving = false;
    return;
  }

  if (state.isEditingNote && content === originalContent.trim()) {
    isSaving = false;
    return;
  }

  const toastId = showToast({
    dataI18n: state.isEditingNote ? "updating" : "creating",
    type: "loading",
    duration: null,
  });

  try {
    if (state.isEditingNote) {
      await updateNote(state.currentEditingNoteId, content);

      updateNoteInPlace(state.currentEditingNoteId, content);

      updateToast(toastId, {
        dataI18n: "success",
        type: "success",
        duration: 1000,
      });
    } else {
      const savedNoteId = await saveNote({
        content,
        url: state.currentEditingNoteUrl || state.currentPageUrl,
      });

      addNoteInPlace({
        id: savedNoteId,
        content: content,
        url: state.currentEditingNoteUrl || state.currentPageUrl,
        timestamp: Date.now(),
      });

      updateToast(toastId, {
        dataI18n: "success",
        type: "success",
        duration: 1000,
      });
    }

    closeNoteEditor();
  } catch (error) {
    console.error("Error saving note:", error);
    updateToast(toastId, {
      dataI18n: "failed",
      type: "error",
      duration: 1000,
    });
  } finally {
    isSaving = false;
  }
}

/**
 * Initiates the note deletion workflow by displaying confirmation modal
 * Serves as entry point for note deletion to ensure user confirmation
 */
export async function deleteNoteItem(noteId) {
  showDeleteNoteModal(noteId);
}

/**
 * Creates and displays a modal dialog for note deletion confirmation
 * Implements accessibility features including keyboard navigation and click-outside-to-close
 * Applies localization and prevents multiple modal instances
 */
function showDeleteNoteModal(noteId) {
  // Prevent multiple modals
  if (document.getElementById("delete-note-modal")) return;

  // Add blur effect to background
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.add("cocbot-blur");

  // Create modal structure
  const modal = document.createElement("div");
  modal.id = "delete-note-modal";
  modal.className = "delete-note-modal-backdrop";

  modal.innerHTML = `
    <div class="delete-note-modal">
      <h3 data-i18n="deleteNote">Delete Note</h3>
      <p data-i18n="deleteNoteConfirmation">Are you sure you want to delete this note? This action cannot be undone.</p>
      <div class="delete-note-modal-actions">
        <button class="button button-danger" id="confirm-delete-note">
          <span data-i18n="confirmDelete">Delete</span>
        </button>
        <button class="button button-secondary" id="cancel-delete-note">
          <span data-i18n="cancel">Cancel</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Apply translations to modal content
  translateElement(modal);

  // Set up event handlers
  const cancelButton = modal.querySelector("#cancel-delete-note");
  const confirmButton = modal.querySelector("#confirm-delete-note");

  cancelButton.addEventListener("click", closeDeleteNoteModal);
  confirmButton.addEventListener("click", async () => {
    await confirmDeleteNote(noteId);
  });

  // Enable keyboard navigation (ESC to close)
  document.addEventListener("keydown", handleEscapeKey);

  // Enable click-outside-to-close functionality
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeDeleteNoteModal();
    }
  });
}

/**
 * Executes the confirmed note deletion operation
 * Handles API communication and provides comprehensive user feedback
 * Updates UI state and displays appropriate success or error messages
 */
async function confirmDeleteNote(noteId) {
  closeDeleteNoteModal();

  const toastId = showToast({
    dataI18n: "deleting",
    type: "loading",
    duration: null,
  });

  try {
    await deleteNote(noteId);

    removeNoteInPlace(noteId);

    updateToast(toastId, {
      dataI18n: "success",
      type: "success",
      duration: 1000,
    });
  } catch (error) {
    console.error("Error deleting note:", error);
    updateToast(toastId, {
      dataI18n: "failed",
      type: "error",
      duration: 1000,
    });
  }
}

/**
 * Closes the delete confirmation modal and performs cleanup
 * Removes modal from DOM, restores background appearance, and cleans up event listeners
 * Prevents memory leaks by properly removing event handlers
 */
function closeDeleteNoteModal() {
  const modal = document.getElementById("delete-note-modal");
  if (modal) {
    modal.remove();
  }

  // Remove visual effects
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.remove("cocbot-blur");

  // Clean up event listeners to prevent memory leaks
  document.removeEventListener("keydown", handleEscapeKey);
}

/**
 * Handles keyboard interactions for modal dialogs
 * Currently processes ESC key to close delete confirmation modal
 * Designed to be extensible for additional keyboard shortcuts
 */
function handleEscapeKey(e) {
  if (e.key === "Escape") {
    closeDeleteNoteModal();
  }
}

/**
 * Configures a note for editing by setting up the global editing state
 * Populates editor with existing note data and opens the note editor interface
 * Serves as bridge between note selection and editor initialization
 */
export function editNote(note) {
  state.isEditingNote = true;
  state.currentEditingNoteUrl = note.url;
  state.currentEditingNoteId = note.id;
  openNoteEditor(note.content, note.url);
}

/**
 * Constructs a complete DOM element for displaying a single note
 * Includes content preview, metadata, action buttons, and event handlers
 * Handles both current page and all notes display modes with conditional URL display
 */
function createNoteItem(note, showUrl = false) {
  const noteItem = document.createElement("div");
  noteItem.className = "note-item";
  noteItem.dataset.id = note.id;
  noteItem.dataset.url = note.url;

  // Format timestamp for display
  const noteDate = new Date(note.timestamp);
  const formattedDate =
    noteDate.toLocaleDateString() + " " + noteDate.toLocaleTimeString();

  // Conditionally include URL display for "All Notes" tab
  const urlDisplay = showUrl
    ? `<div class="note-item-url" data-url="${note.url}">${note.url}</div>`
    : "";

  // Build note item HTML structure
  noteItem.innerHTML = `
    <div class="note-content">${escapeHtml(note.content)}</div>
    <div class="note-meta">
      <span>${formattedDate}</span>
    </div>
    ${urlDisplay}
    <div class="note-actions">
      <button class="note-action-button edit-note" 
              data-i18n-title="editNote" 
              title="${translate("editNote")}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="note-action-button delete-note" 
              data-i18n-title="deleteNote" 
              title="${translate("deleteNote")}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  // Attach event handlers for note actions
  const editButton = noteItem.querySelector(".edit-note");
  editButton.addEventListener("click", (e) => {
    e.stopPropagation();
    editNote(note);
  });

  const deleteButton = noteItem.querySelector(".delete-note");
  deleteButton.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteNoteItem(note.id);
  });

  // Handle URL clicking for "All Notes" tab
  if (showUrl) {
    const urlElement = noteItem.querySelector(".note-item-url");
    if (urlElement) {
      urlElement.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = urlElement.dataset.url;
        if (url) {
          chrome.tabs.create({ url: url });
        }
      });
    }
  }

  // Handle clicking on note item to edit
  noteItem.addEventListener("click", () => {
    editNote(note);
  });

  return noteItem;
}

/**
 * Initializes the note editor interface for creating or editing notes
 * Handles authentication verification, UI setup, and content population
 * Configures editor title and URL display based on creation or editing context
 */
export async function openNoteEditor(existingContent = "", noteUrl = null) {
  if (!existingContent) {
    const authSession = await getUserSession();
    if (!authSession || !authSession.id) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "sign_in_required",
          });
        }
      });
      return;
    }
  }

  const isNewNote = !existingContent;
  const targetUrl = noteUrl || state.currentPageUrl;

  // Set up editor content and visibility
  elements.noteContent.value = existingContent;
  elements.noteEditor.style.display = "flex";

  // Configure editor title and URL display based on context
  if (isNewNote) {
    elements.noteEditorTitle.textContent = translate("addNote");
    elements.noteEditorUrl.textContent = targetUrl;
  } else {
    elements.noteEditorTitle.textContent = translate("editNote");
    elements.noteEditorUrl.textContent = noteUrl || state.currentPageUrl;
  }

  elements.noteEditorUrl.style.cursor = "pointer";
  elements.noteEditorUrl.style.textDecoration = "underline";
  elements.noteEditorUrl.style.color = "var(--primary)";

  elements.noteEditorUrl.removeEventListener("click", handleUrlClick);
  elements.noteEditorUrl.addEventListener("click", handleUrlClick);

  originalContent = existingContent;

  // Focus on content area for immediate typing
  elements.noteContent.focus();
}

/**
 * Closes the note editor and performs comprehensive state cleanup
 * Resets form content, editing state variables, and URL styling
 * Removes event listeners to prevent memory leaks
 */
export function closeNoteEditor() {
  elements.noteEditor.style.display = "none";
  elements.noteContent.value = "";
  state.currentEditingNoteUrl = null;
  state.currentEditingNoteId = null;
  state.isEditingNote = false;
  originalContent = "";
  elements.noteEditorUrl.style.cursor = "";
  elements.noteEditorUrl.style.textDecoration = "";
  elements.noteEditorUrl.style.color = "";
  elements.noteEditorUrl.removeEventListener("click", handleUrlClick);
}

/**
 * Loads notes for the current page with pagination support
 * Handles both initial loading and infinite scroll loading scenarios
 * Manages loading indicators and updates pagination state
 */
async function loadCurrentPageNotes(isLoadingMore = false) {
  const tab = "current";
  const pagination = state.notesPagination[tab];

  if (pagination.isFetching || (!pagination.hasMore && isLoadingMore)) {
    return;
  }

  pagination.isFetching = true;

  if (isLoadingMore) {
    const container = document.querySelector("#notes-list-current");
    showNotesLoadMoreIndicator(container, "current");
  }

  try {
    const currentUrl = await getCurrentTabUrl();
    const offset = isLoadingMore ? state.notesData[tab].length : 0;
    const result = await getNotesForUrl(currentUrl, offset, 20);

    if (isLoadingMore && result.notes.length > 0) {
      state.notesData[tab] = [...state.notesData[tab], ...result.notes];

      const container = document.querySelector("#notes-list-current");
      removeNotesLoadMoreIndicator(container);

      result.notes.forEach((note) => {
        const noteItem = createNoteItem(note, false);
        container.appendChild(noteItem);
      });
    } else {
      state.notesData[tab] = result.notes;
      renderCurrentPageNotes(state.notesData[tab]);
    }

    pagination.hasMore = result.hasMore;
  } catch (error) {
    console.error("Error loading current page notes:", error);

    if (isLoadingMore) {
      const container = document.querySelector("#notes-list-current");
      removeNotesLoadMoreIndicator(container);
    }
  } finally {
    pagination.isFetching = false;
  }
}

/**
 * Loads all user notes across all pages with pagination support
 * Manages loading states and handles both initial and incremental loading
 * Updates global state and renders content appropriately
 */
async function loadAllNotes(isLoadingMore = false) {
  const tab = "all";
  const pagination = state.notesPagination[tab];

  if (pagination.isFetching || (!pagination.hasMore && isLoadingMore)) {
    return;
  }

  pagination.isFetching = true;

  if (isLoadingMore) {
    const container = document.querySelector("#notes-list-all");
    showNotesLoadMoreIndicator(container, "all");
  }

  try {
    const offset = isLoadingMore ? state.notesData[tab].length : 0;
    const result = await getAllNotes(offset, 20);

    if (isLoadingMore && result.notes.length > 0) {
      state.notesData[tab] = [...state.notesData[tab], ...result.notes];

      const container = document.querySelector("#notes-list-all");
      removeNotesLoadMoreIndicator(container);

      result.notes.forEach((note) => {
        const noteItem = createNoteItem(note, true);
        container.appendChild(noteItem);
      });
    } else {
      state.notesData[tab] = result.notes;
      renderAllNotes(state.notesData[tab]);
    }

    pagination.hasMore = result.hasMore;
  } catch (error) {
    console.error("Error loading all notes:", error);

    if (isLoadingMore) {
      const container = document.querySelector("#notes-list-all");
      removeNotesLoadMoreIndicator(container);
    }
  } finally {
    pagination.isFetching = false;
  }
}

/**
 * Configures infinite scroll functionality for notes containers
 * Monitors scroll position and triggers pagination loading when approaching bottom
 * Prevents duplicate listeners and handles tab-specific scroll behavior
 */
function setupNotesInfiniteScroll() {
  if (notesScrollListenerSetup) {
    return;
  }

  const scrollableContainer = document.querySelector(".notes-content");
  if (!scrollableContainer) {
    console.error("Could not find .notes-content for infinite scroll");
    return;
  }

  const scrollHandler = (e) => {
    const element = e.target;
    const threshold = 100;

    const currentTab = state.currentNotesTab;
    const pagination = state.notesPagination[currentTab];

    if (!pagination) {
      console.error("Pagination state not found for tab:", currentTab);
      return;
    }

    if (
      pagination.isFetching ||
      !pagination.hasMore ||
      state.notesData[currentTab].length === 0
    ) {
      return;
    }

    const scrollPercentage =
      (element.scrollTop + element.clientHeight + threshold) /
      element.scrollHeight;

    if (scrollPercentage >= 0.9) {
      if (currentTab === "current") {
        loadCurrentPageNotes(true);
      } else {
        loadAllNotes(true);
      }
    }
  };

  scrollableContainer.addEventListener("scroll", scrollHandler);
  currentScrollHandler = scrollHandler;
  notesScrollListenerSetup = true;
}

/**
 * Removes scroll event listeners to prevent memory leaks
 * Called when switching tabs or cleaning up the notes interface
 * Ensures proper event listener management across tab switches
 */
function cleanupScrollListeners() {
  const scrollableContainer = document.querySelector(".notes-content");
  if (scrollableContainer && currentScrollHandler) {
    scrollableContainer.removeEventListener("scroll", currentScrollHandler);
    currentScrollHandler = null;
    notesScrollListenerSetup = false;
  }
}

/**
 * Performs a complete refresh of the current tab's notes content
 * Resets scroll position and pagination state before loading fresh data
 * Used for manual refresh operations triggered by user actions
 */
export function reloadNotes() {
  const notesContent = document.querySelector(".notes-content");
  if (notesContent) {
    notesContent.scrollTop = 0;
  }

  // Reset pagination for current tab
  const tab = state.currentNotesTab;
  resetNotesPaginationState(tab);

  // Load fresh content
  loadTabContent();
}

/**
 * Resets all notes cache and pagination state to initial values
 * Clears cached data, scroll positions, and pagination counters
 * Used for complete application state reset or user logout scenarios
 */
export function resetNotesCache() {
  notesCacheState.isInitialized.current = false;
  notesCacheState.isInitialized.all = false;
  notesCacheState.lastFetchTime.current = null;
  notesCacheState.lastFetchTime.all = null;
  notesCacheState.needsRefresh.current = false;
  notesCacheState.needsRefresh.all = false;

  notesScrollState.current = 0;
  notesScrollState.all = 0;

  // Also reset data
  resetNotesPaginationState();
}
