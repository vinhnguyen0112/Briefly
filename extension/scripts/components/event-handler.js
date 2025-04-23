import { elements } from './dom-elements.js';
import { state, getApiKey, saveApiKey, getConfig } from './state.js';
import { 
  handleResize, 
  stopResize, 
  addMessageToChat, 
  addTypingIndicator, 
  removeTypingIndicator,
  closeAllPanels, 
  switchToChat,
  handleContentMessage
} from './ui-handler.js';
import { 
  requestPageContent, 
  openContentViewerPopup,
  renderContentInSidebar,
  setupContentExtractionReliability
} from './content-handler.js';
import { callOpenAI, constructPromptWithPageContent, processUserQuery } from './api-handler.js';
import { 
  openNotesPanel, 
  openNoteEditor, 
  closeNoteEditor, 
  handleSaveNote 
} from './notes-handler.js';

// wires up all the event listeners in the app
export function setupEventListeners() {
  elements.closeSidebarButton.addEventListener('click', () => {
    window.parent.postMessage({ action: 'close_sidebar' }, '*');
  });
  
  setupQuickActions();
  
  elements.viewContentButton.addEventListener('click', () => {
    if (state.isContentViewerOpen) {
      elements.contentViewerScreen.style.display = 'none';
      elements.viewContentButton.classList.remove('active');
      state.isContentViewerOpen = false;
      
      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = 'flex';
      } else {
        elements.chatScreen.style.display = 'flex';
      }
    } else {
      closeAllPanels();
      
      openContentViewerPopup();
      elements.viewContentButton.classList.add('active');
      state.isContentViewerOpen = true;
    }
  });
  
  elements.saveApiKeyButton.addEventListener('click', () => {
    const apiKey = elements.apiKeyInput.value.trim();
    if (apiKey) {
      saveApiKey(apiKey).then(() => {
        console.log('CocBot: API key saved');
        elements.apiKeyContainer.style.display = 'none';
        elements.settingsButton.classList.remove('active');
        state.isSettingsOpen = false;
      });
    }
  });
  
  elements.settingsButton.addEventListener('click', () => {
    if (state.isSettingsOpen) {
      elements.apiKeyContainer.style.display = 'none';
      elements.settingsButton.classList.remove('active');
      state.isSettingsOpen = false;
      
      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = 'flex';
      } else {
        elements.chatScreen.style.display = 'flex';
      }
    } else {
      closeAllPanels();
      
      elements.apiKeyContainer.style.display = 'flex';
      elements.settingsButton.classList.add('active');
      state.isSettingsOpen = true;
    }
  });
  
  elements.configButton.addEventListener('click', () => {
    if (state.isConfigOpen) {
      elements.configContainer.style.display = 'none';
      elements.configButton.classList.remove('active');
      state.isConfigOpen = false;
      
      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = 'flex';
      } else {
        elements.chatScreen.style.display = 'flex';
      }
    } else {
      closeAllPanels();
      
      elements.configContainer.style.display = 'block';
      elements.configButton.classList.add('active');
      state.isConfigOpen = true;
      
      renderConfigUI('config-content', (newConfig) => {
        state.currentConfig = newConfig;
        elements.configContainer.style.display = 'none';
        elements.configButton.classList.remove('active');
        state.isConfigOpen = false;
        addMessageToChat("Settings updated! I'll use these for future responses.", 'assistant');
      });
    }
  });
  
  elements.configCloseButton.addEventListener('click', () => {
    elements.configContainer.style.display = 'none';
    elements.configButton.classList.remove('active');
    state.isConfigOpen = false;
    
    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = 'flex';
    } else {
      elements.chatScreen.style.display = 'flex';
    }
  });
  
  elements.resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.isResizing = true;
    elements.resizeHandle.classList.add('active');
    document.body.classList.add('sidebar-resizing');
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  });
  
  elements.welcomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = elements.welcomeInput.value.trim();
    if (!query) return;
    
    switchToChat();
    
    processUserQuery(query);
    
    elements.welcomeInput.value = '';
  });
  
  elements.welcomeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const query = elements.welcomeInput.value.trim();
      if (query) {
        switchToChat();
        processUserQuery(query);
        elements.welcomeInput.value = '';
      }
    }
  });
  
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = elements.userInput.value.trim();
    if (!message) return;
    
    processUserQuery(message);
    
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
  });
  
  elements.userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  elements.userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      const message = elements.userInput.value.trim();
      if (message) {
        processUserQuery(message);
        elements.userInput.value = '';
        elements.userInput.style.height = 'auto';
      }
    }
  });
  
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
      handleContentMessage(event.data);
    }
  });
  
  elements.refreshContentButton.addEventListener('click', () => {
    requestPageContent();
    
    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-loading">
        <div class="spinner"></div>
        <p>Refreshing page content...</p>
      </div>
    `;
  });
  
  elements.closeContentButton.addEventListener('click', () => {
    elements.contentViewerScreen.style.display = 'none';
    elements.viewContentButton.classList.remove('active');
    state.isContentViewerOpen = false;
    
    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = 'flex';
    } else {
      elements.chatScreen.style.display = 'flex';
    }
  });
  
  elements.notesButton.addEventListener('click', () => {
    if (state.isNotesOpen) {
      elements.notesScreen.style.display = 'none';
      elements.notesButton.classList.remove('active');
      state.isNotesOpen = false;
      
      if (state.welcomeMode) {
        elements.welcomeScreen.style.display = 'flex';
      } else {
        elements.chatScreen.style.display = 'flex';
      }
    } else {
      closeAllPanels();
      
      openNotesPanel();
      elements.notesButton.classList.add('active');
      state.isNotesOpen = true;
    }
  });
  
  elements.closeNotesButton.addEventListener('click', () => {
    elements.notesScreen.style.display = 'none';
    elements.notesButton.classList.remove('active');
    state.isNotesOpen = false;
    
    if (state.welcomeMode) {
      elements.welcomeScreen.style.display = 'flex';
    } else {
      elements.chatScreen.style.display = 'flex';
    }
  });
  
  elements.addNoteButton.addEventListener('click', () => {
    openNoteEditor();
  });
  
  elements.createFirstNoteButton.addEventListener('click', () => {
    openNoteEditor();
  });
  
  elements.saveNoteButton.addEventListener('click', () => {
    handleSaveNote();
  });
  
  elements.cancelNoteButton.addEventListener('click', () => {
    closeNoteEditor();
  });
  
  elements.closeEditorButton.addEventListener('click', () => {
    closeNoteEditor();
  });
}

// set up quick action buttons
function setupQuickActions() {
  elements.quickActionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      let query = '';
      
      switch (action) {
        case 'summarize':
          query = 'Summarize this page in a concise way.';
          break;
        case 'keypoints':
          query = 'What are the key points of this page?';
          break;
        case 'explain':
          query = 'Explain the content of this page as if I\'m a beginner.';
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
    console.error('CocBot: Config container not found');
    return;
  }
  
  getConfig().then(config => {
    const currentPersonality = config?.personality || 'Be friendly and concise, and stick to the facts in the content.';
    
    container.innerHTML = `
      <div class="config-section">
        <h3>Chat Settings</h3>
        <div class="config-form">
          <div class="form-group">
            <label for="personality">Assistant Personality:</label>
            <textarea id="personality" rows="4">${currentPersonality}</textarea>
            <div class="help-text">How should the assistant respond to questions?</div>
          </div>
          
          <div class="form-actions">
            <button id="save-config" type="button">Save Settings</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('save-config').addEventListener('click', () => {
      const personality = document.getElementById('personality').value;
      
      const newConfig = {
        ...config,
        personality
      };
      
      chrome.storage.local.set({ 'config': newConfig }, () => {
        console.log('CocBot: Config saved', newConfig);
        if (onSave) onSave(newConfig);
      });
    });
  });
} 