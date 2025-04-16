// DOM Elements for popup
const toggleSidebarButton = document.getElementById('toggle-sidebar');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');

// popup // same shit with sidebar
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
    if (response && response.apiKey) {
      apiKeyInput.value = '********'; 
    }
  });
});

toggleSidebarButton.addEventListener('click', toggleSidebar);
saveApiKeyButton.addEventListener('click', saveApiKey);

function toggleSidebar() {
  // get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      })
      .then(() => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle_sidebar' }, (response) => {

          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          }
          window.close();
        });
      })
      .catch(error => {
        console.error('Error injecting content script:', error);
        alert('Could not open sidebar on this page. Try a different page.');
        window.close();
      });
    }
  });
}

// same shit with sidebar
function saveApiKey() {
  const newApiKey = apiKeyInput.value.trim();
  
  if (!newApiKey) {
    alert('Please enter a valid API key');
    return;
  }
  
  if (newApiKey === '********') {
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'saveApiKey', 
    apiKey: newApiKey 
  }, (response) => {
    if (response && response.success) {
      apiKeyInput.value = '********'; 
      alert('API key saved successfully!');
    }
  });
}
