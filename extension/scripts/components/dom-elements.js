// DOM elements module - contains all references to DOM elements
export const elements = {
  // Screens
  chatScreen: document.getElementById("chat-screen"),
  chatHistoryScreen: document.getElementById("chat-history-screen"),
  notesScreen: document.getElementById("notes-screen"),

  // Header elements
  titleContainer: document.getElementById("title-container"),

  // Authentication elements
  googleLoginButtons: document.querySelectorAll(".google-login-button"),
  facebookLoginButtons: document.querySelectorAll(".facebook-login-button"),
  accountButton: document.getElementById("account-button"),
  accountPopup: document.getElementById("account-popup"),
  signOutButton: document.getElementById("sign-out-button"),

  // Alert elements
  signInAlertPopup: document.getElementById("sign-in-alert-popup"),
  signInAlertOverlay: document.getElementById("sign-in-alert-overlay"),
  closeSignInAlertButton: document.getElementById("close-sign-in-alert-button"),

  // Chat elements
  chatForm: document.getElementById("chat-form"),
  userInput: document.getElementById("user-input"),
  chatContainer: document.getElementById("chat-container"),
  messageContainer: document.getElementById("message-container"),

  // Sidebar elements
  closeSidebarButton: document.getElementById("close-sidebar"),
  resizeHandle: document.getElementById("sidebar-resize-handle"),
  sidebar: document.querySelector(".sidebar"),

  // Config elements
  configButton: document.getElementById("config-button"),
  configCloseButton: document.getElementById("config-close"),
  configContainer: document.getElementById("config-container"),

  // Language toggle
  languageToggle: document.getElementById("language-toggle"),

  // Quick action buttons
  quickActionButtons: document.querySelectorAll(".action-button"),

  // Notes elements
  notesButton: document.getElementById("notes-button"),
  closeNotesButton: document.getElementById("close-notes-button"),
  addNoteButton: document.getElementById("add-note-button"),
  reloadNotesButton: document.getElementById("reload-notes-button"),

  // Tab controls
  notesTabCurrent: document.getElementById("notes-tab-current"),
  notesTabAll: document.getElementById("notes-tab-all"),

  // Tab content areas
  notesTabCurrentContent: document.getElementById("notes-tab-current-content"),
  notesTabAllContent: document.getElementById("notes-tab-all-content"),

  // Lists for each tab
  notesListCurrent: document.getElementById("notes-list-current"),
  notesListAll: document.getElementById("notes-list-all"),

  // Empty states for each tab
  notesEmptyStateCurrent: document.getElementById("notes-empty-state-current"),
  notesEmptyStateAll: document.getElementById("notes-empty-state-all"),

  // Create buttons for each tab
  createFirstNoteButtonCurrent: document.getElementById(
    "create-first-note-current"
  ),
  createFirstNoteButtonAll: document.getElementById("create-first-note-all"),

  // Note editor (shared)
  noteEditor: document.getElementById("note-editor"),
  noteEditorTitle: document.getElementById("note-editor-title"),
  noteEditorUrl: document.getElementById("note-editor-url"),
  noteContent: document.getElementById("note-content"),
  saveNoteButton: document.getElementById("save-note-button"),
  cancelNoteButton: document.getElementById("cancel-note-button"),
  closeEditorButton: document.getElementById("close-editor-button"),

  // New chat elements
  newChatButton: document.getElementById("new-chat-button"),

  // Non-dynamic chat history elements
  chatHistoryList: document.getElementById("chat-history-list"),
  chatHistoryEmpty: document.getElementById("chat-history-empty"),
  chatHistoryFail: document.getElementById("chat-history-fail"),
};
