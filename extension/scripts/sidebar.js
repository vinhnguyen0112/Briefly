import { loadSidebarWidth, getApiKey, getConfig } from './components/state.js';
import { setupEventListeners } from './components/event-handler.js';
import { requestPageContent, setupContentExtractionReliability } from './components/content-handler.js';
import { processUserQuery } from './components/api-handler.js';

// main app initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('CocBot: Ready to rock');
  
  // check for api key
  getApiKey().then(key => {
    if (key) {
      document.getElementById('api-key').value = key;
    }
  });
  
  // load config
  getConfig().then(config => {
    window.currentConfig = config;
    console.log('CocBot: Got the settings', config);
  });
  
  // set width from last time
  loadSidebarWidth();
  
  // set up event listeners
  setupEventListeners();
  
  // get page content
  requestPageContent();
  
  // make sure content extraction is reliable
  setupContentExtractionReliability();
});

// expose certain functions to the global scope that might be needed by inline event handlers
window.processUserQuery = processUserQuery; 