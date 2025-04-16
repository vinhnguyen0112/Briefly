// installation event
chrome.runtime.onInstalled.addListener(() => {
  console.log('ISAL Assistant extension installed');
});

// extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  // cannot inject scripts into chrome:// pages and other restricted pages
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') || 
      tab.url.startsWith('https://chrome.google.com/webstore/')) {
        //needs to test more to see which pages are restricted
    
    // show popup on restricted pages instead
    chrome.action.setPopup({ 
      popup: 'popup.html',
      tabId: tab.id 
    });
    
    // try to open the popup
    setTimeout(() => {
      chrome.action.openPopup();
    }, 100);
    
    return;
  }
  
  // inject the content script 
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  })
  .then(() => {
    // ->send message to toggle sidebar
    chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' })
    .catch(error => console.error('Error sending message:', error));
  })
  .catch(error => {
    console.error('Error injecting content script:', error);
    //basic ass error handling
    
    // Set and open popup with error message
    chrome.action.setPopup({ 
      popup: 'popup.html',
      tabId: tab.id 
    });
    
    // Try to open the popup
    setTimeout(() => {
      chrome.action.openPopup();
    }, 100);
  });
});

// Handle opening settings popup if requested
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSettings') {
    // Set the popup for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.action.setPopup({ 
          popup: 'popup.html',
          tabId: tabs[0].id 
        });
        // Try to open the popup
        setTimeout(() => {
          chrome.action.openPopup();
        }, 100);
      }
    });
    return true;
  }
  
  if (message.action === 'saveApiKey') {
    // Save API key to chrome storage
    chrome.storage.sync.set({ openaiApiKey: message.apiKey }, () => {
      console.log('API key saved');
      sendResponse({ success: true });
    });
    return true; // Indicate async response
  }
  
  if (message.action === 'getApiKey') {
    // Retrieve API key from chrome storage
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      sendResponse({ apiKey: result.openaiApiKey || '' });
    });
    return true; // Indicate async response
  }
});
