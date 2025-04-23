// DOM Elements
const openSettingsButton = document.getElementById('open-settings');

// Log for debugging
console.log('Popup script loaded');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM fully loaded');
  
  // Set up event listeners only if elements exist
  if (openSettingsButton) {
    openSettingsButton.addEventListener('click', openSettings);
  }
});

// When popup is about to close
window.addEventListener('unload', () => {
  console.log('Popup closing, sending closeSettings message');
  // Tell background script we're closing so it can reset the action popup
  chrome.runtime.sendMessage({ action: 'closeSettings' });
});

// Open settings
function openSettings() {
  console.log('Open settings button clicked');
  // Tell background to handle opening settings
  chrome.runtime.sendMessage({ action: 'openSettings' }, () => {
    // Close this popup
    window.close();
  });
}

// For future implementation: Toggle sidebar
function toggleSidebar() {
  console.log('Toggle sidebar button clicked');
  
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      console.log('Found active tab:', tabs[0].id);
      
      // First, inject the content script to ensure it's loaded
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      })
      .then(() => {
        console.log('Content script injected successfully');
        
        // Now send the message to toggle the sidebar
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle_sidebar' }, (response) => {
          // Check for error
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          } else {
            console.log('Sidebar toggle message sent successfully');
          }
          
          // Tell background to reset popup state
          chrome.runtime.sendMessage({ action: 'closeSettings' }, () => {
            // Close the popup
            window.close();
          });
        });
      })
      .catch(error => {
        console.error('Error injecting content script:', error);
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
          errorMessage.textContent = 'Could not open sidebar on this page. Try a different page.';
          errorMessage.style.display = 'block';
        } else {
          alert('Could not open sidebar on this page. Try a different page.');
        }
      });
    }
  });
}

// For future implementation: Save API key
function saveApiKey() {
  console.log('Save API key button clicked');
  
  const apiKeyInput = document.getElementById('api-key');
  if (!apiKeyInput) return;
  
  const newApiKey = apiKeyInput.value.trim();
  
  if (!newApiKey) {
    alert('Please enter a valid API key');
    return;
  }
  
  // Don't resave the masked key
  if (newApiKey === '********') {
    window.close();
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'saveApiKey', 
    apiKey: newApiKey 
  }, (response) => {
    if (response && response.success) {
      console.log('API key saved successfully');
      apiKeyInput.value = '********'; // Mask the key
      alert('API key saved successfully!');
      
      // Close the popup after successful save
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'closeSettings' }, () => {
          window.close();
        });
      }, 500);
    }
  });
}
