// DOM elements module - contains all references to DOM elements
export const elements = {
  // Screens
  welcomeScreen: document.getElementById("welcome-screen"),
  chatScreen: document.getElementById("chat-screen"),
  chatHistoryScreen: document.getElementById("chat-history-screen"),
  contentViewerScreen: document.getElementById("content-viewer-screen"),
  notesScreen: document.getElementById("notes-screen"),

  // Header elements
  cocbotTitle: document.getElementById("cocbot-title"),

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

  // Content viewer elements
  contentDisplay: document.getElementById("content-display"),

  // Welcome screen elements
  welcomeForm: document.getElementById("welcome-form"),
  welcomeInput: document.getElementById("welcome-input"),

  // Chat elements
  chatForm: document.getElementById("chat-form"),
  userInput: document.getElementById("user-input"),
  chatContainer: document.getElementById("chat-container"),

  // API key elements
  apiKeyInput: document.getElementById("api-key"),
  saveApiKeyButton: document.getElementById("save-api-key"),
  apiKeyContainer: document.querySelector(".api-key-container"),

  // Sidebar elements
  closeSidebarButton: document.getElementById("close-sidebar"),
  resizeHandle: document.getElementById("sidebar-resize-handle"),
  sidebar: document.querySelector(".sidebar"),

  // Config elements
  configButton: document.getElementById("config-button"),
  configCloseButton: document.getElementById("config-close"),
  configContainer: document.getElementById("config-container"),

  // Content viewer buttons
  viewContentButton: document.getElementById("view-content-button"),
  refreshContentButton: document.getElementById("refresh-content-button"),
  closeContentButton: document.getElementById("close-content-button"),

  // Settings button
  settingsButton: document.getElementById("settings-button"),

  settingsButton: document.getElementById("settings-button"),

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

  // Chat history elements
  chatHistoryList: document.getElementById("chat-history-list"),
  chatHistoryEmpty: document.getElementById("chat-history-empty"),
  clearChatHistoryButton: document.getElementById("clear-chat-history-button"),
  refreshChatHistoryButton: document.getElementById(
    "refresh-chat-history-button"
  ),
};
