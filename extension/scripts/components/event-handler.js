import { elements } from "./dom-elements.js";
import {
  state,
  getApiKey,
  saveApiKey,
  getConfig,
  saveConfig,
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

// wires up all the event listeners in the app
export function setupEventListeners() {
  elements.closeSidebarButton.addEventListener("click", () => {
    window.parent.postMessage({ action: "close_sidebar" }, "*");
  });

  // Cocbot authentication button events
  elements.googleLoginButton.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { action: "google_authentication" },
      (response) => {
        console.log("User authenticated via Google.");
      }
    );
  });

  // CocBot title click to return to welcome screen
  elements.cocbotTitle.addEventListener("click", () => {
    if (!state.welcomeMode) {
      elements.chatScreen.style.display = "none";
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
    }
  });

  setupQuickActions();

  elements.viewContentButton.addEventListener("click", () => {
    if (state.isContentViewerOpen) {
      elements.contentViewerScreen.style.display = "none";
      elements.viewContentButton.classList.remove("active");
      state.isContentViewerOpen = false;

      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = "flex";
      } else {
        elements.chatScreen.style.display = "flex";
      }
    } else {
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

// external function for rendering UI config
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
        <h3 class="config-title">Response Settings</h3>
        <div class="config-form">
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
          
          <div class="form-group">
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
          padding: 1.5rem;
          background-color: var(--background-color, #ffffff);
          border-radius: 0.5rem;
        }
        .config-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: var(--text-color, #111827);
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
          padding: 0.75rem 0 0.5rem;
        }
        .slider {
          appearance: none;
          width: 100%;
          height: 0.25rem;
          background: var(--border-color, #e5e7eb);
          border-radius: 1rem;
          margin-bottom: 0.5rem;
          outline: none;
        }
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 1rem;
          height: 1rem;
          background: var(--primary-color, #4a86e8);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }
        .slider::-webkit-slider-thumb:hover {
          background: var(--primary-hover, #3a76d8);
          transform: scale(1.1);
        }
        .slider-markers {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.75rem;
          color: var(--muted-color, #6b7280);
        }
        .radio-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
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
          margin-top: 1rem;
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
