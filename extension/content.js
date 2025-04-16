let sidebarInjected = false;

// create and inject the sidebar UI
function injectSidebar() {
  if (sidebarInjected) return;
  sidebarInjected = true;
  
  console.log("ISAL Assistant: Injecting sidebar");
  
  //container for sidebar
  const container = document.createElement('div');
  container.id = 'isal-sidebar-container';
  
  // iframe to load sidebar.html 
  const iframe = document.createElement('iframe');
  iframe.id = 'isal-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  container.appendChild(iframe);
  
  // toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'isal-toggle-button';
  toggleButton.innerHTML = '&lt;';
  toggleButton.title = 'Toggle Assistant';
  
  // elements to the page to show
  document.body.appendChild(container);
  document.body.appendChild(toggleButton);
  
  // toggle sidebar visibility 
  toggleButton.addEventListener('click', () => {
    toggleSidebar();
  });
  
  // sidebar iframe and content script comms
  window.addEventListener('message', (event) => {
    if (event.source === iframe.contentWindow) {
      handleSidebarMessage(event.data);
    }
  });
  
  console.log("ISAL Assistant: Sidebar injected successfully");
}

// Toggle sidebar visibility
function toggleSidebar() {
  console.log("ISAL Assistant: Toggle sidebar requested");
  const container = document.getElementById('isal-sidebar-container');
  const toggleButton = document.getElementById('isal-toggle-button');
  
  if (container && toggleButton) {
    const isActive = container.classList.toggle('active');
    toggleButton.innerHTML = isActive ? '&gt;' : '&lt;';
    console.log("ISAL Assistant: Sidebar toggled, active state:", isActive);
  } else {
    console.error("ISAL Assistant: Sidebar elements not found");
    injectSidebar();
    setTimeout(() => {
      const newContainer = document.getElementById('isal-sidebar-container');
      if (newContainer) {
        newContainer.classList.add('active');
        const newToggleButton = document.getElementById('isal-toggle-button');
        if (newToggleButton) {
          newToggleButton.innerHTML = '&gt;';
        }
      }
    }, 100);
  }
}

function handleSidebarMessage(message) {
  switch (message.action) {
    case 'close_sidebar':
      const container = document.getElementById('isal-sidebar-container');
      if (container) {
        container.classList.remove('active');
        document.getElementById('isal-toggle-button').innerHTML = '&lt;';
      }
      break;
      
    case 'get_page_content':
      const pageContent = {
        title: document.title,
        url: window.location.href,
        selection: window.getSelection().toString(),
      };
      
      // page content back to sidebar
      const iframe = document.getElementById('isal-sidebar-iframe');
      if (iframe) {
        iframe.contentWindow.postMessage({
          action: 'page_content',
          content: pageContent
        }, '*');
      }
      break;
  }
}

// listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ISAL Assistant: Message received in content script:", message);
  
  if (message.action === 'toggle_sidebar') {
    // ensure sidebar is injected first
    if (!sidebarInjected) {
      injectSidebar();
    }
    toggleSidebar();
    sendResponse({ success: true });
  }
  return true;
});

// PAGE NEEDS TO LOAD FULLY before injecting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}
