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
  notesList: document.getElementById("notes-list"),
  notesEmptyState: document.getElementById("notes-empty-state"),
  createFirstNoteButton: document.getElementById("create-first-note"),
  noteEditor: document.getElementById("note-editor"),
  noteContent: document.getElementById("note-content"),
  saveNoteButton: document.getElementById("save-note-button"),
  cancelNoteButton: document.getElementById("cancel-note-button"),
  closeEditorButton: document.getElementById("close-editor-button"),

  // New chat elements
  newChatButton: document.getElementById("new-chat-button"),

  // Non-dynamic chat history elements
  chatHistoryList: document.getElementById("chat-history-list"),
  chatHistoryEmpty: document.getElementById("chat-history-empty"),
};
