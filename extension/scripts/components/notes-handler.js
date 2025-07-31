import { elements } from "./dom-elements.js";
import {
  state,
  getNotesForUrl,
  getAllNotes,
  getCurrentTabUrl,
  saveNote,
  updateNote,
  deleteNote,
  getNotesCount,
} from "./state.js";
import { translate, translateElement } from "./i18n.js";
import { escapeHtml, showToast, updateToast } from "./ui-handler.js";
import { isSignInNeeded } from "./auth-handler.js";

/**
 * Opens the notes panel and initializes it with current page content
 * Handles sign-in modal dismissal and screen switching
 */
export async function openNotesPanel() {
  const currentUrl = await getCurrentTabUrl();
  state.currentPageUrl = currentUrl;

  // Dismiss any active sign-in modal
  const signInModal = document.querySelector("#sign-in-alert-overlay");
  if (signInModal) {
    signInModal.style.display = "none";
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.classList.remove("sign-in-blur");
  }

  // Switch from chat screen to notes screen
  if (elements.chatScreen) {
    elements.chatScreen.style.display = "none";
  }
  if (elements.notesScreen) {
    elements.notesScreen.style.display = "flex";
  }

  // Load initial content and update counters
  loadTabContent();
  updateNotesCount();
}

/**
 * Reloads notes content for the current active tab
 * Useful for refreshing data after external changes
 */
export function reloadNotes() {
  console.log("Reloading notes...");
  loadTabContent();
  updateNotesCount();
}

/**
 * Switches between "current page" and "all notes" tabs
 * Updates UI state and loads appropriate content
 * @param {string} tabName - Either "current" or "all"
 */
export function switchNotesTab(tabName) {
  // Update tab button active states
  elements.notesTabCurrent.classList.toggle("active", tabName === "current");
  elements.notesTabAll.classList.toggle("active", tabName === "all");

  // Update tab content visibility
  elements.notesTabCurrentContent.classList.toggle(
    "active",
    tabName === "current"
  );
  elements.notesTabAllContent.classList.toggle("active", tabName === "all");

  // Update global state and reload content
  state.currentNotesTab = tabName;
  loadTabContent();
  updateNotesCount();
}

/**
 * Loads and renders content for the currently active notes tab
 * Handles errors by showing empty states as fallback
 */
async function loadTabContent() {
  try {
    const currentUrl = await getCurrentTabUrl();
    state.currentPageUrl = currentUrl;

    if (state.currentNotesTab === "current") {
      const notes = await getNotesForUrl(currentUrl);
      renderCurrentPageNotes(notes);
    } else {
      const allNotes = await getAllNotes();
      renderAllNotes(allNotes);
    }
  } catch (error) {
    console.error("CocBot: Error loading notes", error);
    // Show empty states on error as graceful fallback
    if (state.currentNotesTab === "current") {
      renderCurrentPageNotes([]);
    } else {
      renderAllNotes([]);
    }
  }
}

/**
 * Renders notes list for the current page tab
 * Shows empty state when no notes exist, otherwise displays sorted notes
 * @param {Array} notes - Array of note objects for current page
 */
function renderCurrentPageNotes(notes) {
  const container = elements.notesListCurrent;
  const emptyState = elements.notesEmptyStateCurrent;

  if (!notes || notes.length === 0) {
    emptyState.style.display = "flex";
    container.innerHTML = "";
    return;
  }

  emptyState.style.display = "none";
  container.innerHTML = "";

  // Sort notes by timestamp (newest first)
  notes.sort((a, b) => b.timestamp - a.timestamp);

  notes.forEach((note) => {
    const noteItem = createNoteItem(note, false);
    container.appendChild(noteItem);
  });
}

/**
 * Renders notes list for the all notes tab
 * Shows empty state when no notes exist, otherwise displays all notes
 * @param {Array} notes - Array of all note objects
 */
function renderAllNotes(notes) {
  const container = elements.notesListAll;
  const emptyState = elements.notesEmptyStateAll;

  if (!notes || notes.length === 0) {
    emptyState.style.display = "flex";
    container.innerHTML = "";
    return;
  }

  emptyState.style.display = "none";
  container.innerHTML = "";

  notes.forEach((note) => {
    const noteItem = createNoteItem(note, true);
    container.appendChild(noteItem);
  });
}

/**
 * Handles saving a new note or updating an existing note
 * Includes authentication check, validation, and progress feedback
 */
export async function handleSaveNote() {
  // Check if user authentication is required
  const notAllowed = await isSignInNeeded();
  if (notAllowed) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "sign_in_required",
        });
      }
    });
    return;
  }

  // Validate note content
  const content = elements.noteContent.value.trim();
  if (!content) {
    showToast({
      message:
        state.language === "en"
          ? "Please enter some content for your note"
          : "Vui lòng nhập nội dung ghi chú",
      type: "info",
    });
    return;
  }

  // Show loading state with appropriate message
  const toastId = showToast({
    message: state.isEditingNote
      ? state.language === "en"
        ? "Updating note..."
        : "Đang cập nhật ghi chú..."
      : state.language === "en"
      ? "Creating note..."
      : "Đang tạo ghi chú...",
    type: "loading",
    duration: null,
  });

  try {
    const currentUrl = await getCurrentTabUrl();

    if (state.isEditingNote && state.currentEditingNoteId) {
      // Update existing note
      await updateNote(state.currentEditingNoteId, content);
      updateToast(toastId, {
        message:
          state.language === "en"
            ? "Note updated successfully!"
            : "Cập nhật ghi chú thành công!",
        type: "success",
        duration: 2000,
      });
    } else {
      // Create new note
      const noteData = {
        content,
        url: currentUrl,
        timestamp: Date.now(),
      };

      await saveNote(noteData);
      updateToast(toastId, {
        message:
          state.language === "en"
            ? "Note created successfully!"
            : "Tạo ghi chú thành công!",
        type: "success",
        duration: 2000,
      });
    }

    // Clean up and refresh UI
    closeNoteEditor();
    loadTabContent();
    updateNotesCount();
  } catch (error) {
    console.error("Error saving note:", error);
    updateToast(toastId, {
      message:
        state.language === "en"
          ? "Failed to save note. Please try again."
          : "Lưu ghi chú thất bại. Vui lòng thử lại.",
      type: "error",
      duration: 3000,
    });
  }
}

/**
 * Initiates the note deletion process by showing confirmation modal
 * @param {string} noteId - Unique identifier of the note to delete
 */
export async function deleteNoteItem(noteId) {
  showDeleteNoteModal(noteId);
}

/**
 * Creates and displays a confirmation modal for note deletion
 * Handles modal creation, event binding, and accessibility features
 * @param {string} noteId - Unique identifier of the note to delete
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
 * Executes the actual note deletion after user confirmation
 * Provides feedback through toast notifications
 * @param {string} noteId - Unique identifier of the note to delete
 */
async function confirmDeleteNote(noteId) {
  const toastId = showToast({
    message:
      state.language === "en" ? "Deleting note..." : "Đang xóa ghi chú...",
    type: "loading",
    duration: null,
  });

  try {
    await deleteNote(noteId);
    updateToast(toastId, {
      message:
        state.language === "en"
          ? "Note deleted successfully!"
          : "Xóa ghi chú thành công!",
      type: "success",
      duration: 2000,
    });

    // Clean up modal and refresh UI
    closeDeleteNoteModal();
    loadTabContent();
    updateNotesCount();
  } catch (error) {
    console.error("Error deleting note:", error);
    updateToast(toastId, {
      message:
        state.language === "en"
          ? "Failed to delete note. Please try again."
          : "Xóa ghi chú thất bại. Vui lòng thử lại.",
      type: "error",
      duration: 3000,
    });
  }
}

/**
 * Closes the delete confirmation modal and cleans up associated resources
 * Removes blur effects and event listeners
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
 * Handles keyboard events for modal interactions
 * Currently handles ESC key to close delete modal
 * @param {KeyboardEvent} e - The keyboard event object
 */
function handleEscapeKey(e) {
  if (e.key === "Escape") {
    closeDeleteNoteModal();
  }
}

/**
 * Prepares a note for editing by setting up editor state
 * Updates global state variables and opens the note editor
 * @param {Object} note - The note object containing content, url, and id
 */
export function editNote(note) {
  state.isEditingNote = true;
  state.currentEditingNoteUrl = note.url;
  state.currentEditingNoteId = note.id;
  openNoteEditor(note.content, note.url);
}

/**
 * Creates a DOM element representing a single note item
 * Includes content preview, metadata, actions, and event handlers
 * @param {Object} note - The note object with content,  url, and id
 * @param {boolean} showUrl - Whether to display the URL in the note item
 * @returns {HTMLElement} The complete note item DOM element
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
 * Updates the note count displays for both current page and all notes tabs
 * Handles errors gracefully by showing zero counts as fallback
 */
async function updateNotesCount() {
  try {
    const currentUrl = await getCurrentTabUrl();
    state.currentPageUrl = currentUrl;

    const counts = await getNotesCount(currentUrl);

    // Update count displays in UI
    if (elements.currentPageCount) {
      elements.currentPageCount.textContent = counts.page;
    }
    if (elements.allNotesCount) {
      elements.allNotesCount.textContent = counts.total;
    }
  } catch (error) {
    console.error("Error updating notes count:", error);
    // Fallback to zero counts on error
    if (elements.currentPageCount) {
      elements.currentPageCount.textContent = "0";
    }
    if (elements.allNotesCount) {
      elements.allNotesCount.textContent = "0";
    }
  }
}

/**
 * Opens the note editor interface for creating new notes or editing existing ones
 * Handles authentication checks and sets up the editor with appropriate content
 * @param {string} existingContent - Content to populate editor with (empty for new notes)
 * @param {string} noteUrl - URL associated with the note (null for current page)
 */
export async function openNoteEditor(existingContent = "", noteUrl = null) {
  // Skip authentication check for existing notes (already authenticated)
  if (!existingContent) {
    const notAllowed = await isSignInNeeded();
    if (notAllowed) {
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

  // Focus on content area for immediate typing
  elements.noteContent.focus();
}

/**
 * Closes the note editor and resets all editing state
 * Cleans up form content and global state variables
 */
export function closeNoteEditor() {
  elements.noteEditor.style.display = "none";
  elements.noteContent.value = "";
  state.currentEditingNoteUrl = null;
  state.isEditingNote = false;
}
