//Content Viewer shit

// init the content viewer
function initContentViewer(containerId, onClose = null) {
  // Get or create the container element
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }
  
  // toolbar and content container
  let viewerCreated = false;
  let currentData = null;
  
  // create the UI
  function createViewerUI() {
    if (viewerCreated) return;
    
    container.classList.add('content-viewer-ui-container');
    container.innerHTML = `
      <div class="content-viewer-ui-toolbar">
        <h3>Page Content Viewer</h3>
        <div class="content-viewer-ui-actions">
          <button id="${containerId}-refresh" class="content-viewer-ui-button" title="Refresh content">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
          <button id="${containerId}-close" class="content-viewer-ui-button" title="Close viewer">×</button>
        </div>
      </div>
      <div id="${containerId}-content" class="content-viewer-ui-content">
        <div class="content-viewer-ui-loading">
          <p>Loading page content...</p>
        </div>
      </div>
    `;
    
    // Add event listeners
    document.getElementById(`${containerId}-close`).addEventListener('click', () => {
      hideViewer();
      if (typeof onClose === 'function') onClose();
    });
    
    document.getElementById(`${containerId}-refresh`).addEventListener('click', () => {
      refreshContent();
    });
    
    viewerCreated = true;
  }
  
  // show the viewer
  function showViewer(pageContent) {
    createViewerUI();
    currentData = pageContent;
    
    container.style.display = 'flex';
    
    renderContent(pageContent);
  }
  
  // hide the viewer
  function hideViewer() {
    container.style.display = 'none';
  }
  
  // render the content
  function renderContent(pageContent) {
    const contentContainer = document.getElementById(`${containerId}-content`);
    
    if (!pageContent) {
      contentContainer.innerHTML = `
        <div class="content-viewer-ui-error">
          <p>No content available. Try refreshing the page content.</p>
        </div>
      `;
      return;
    }
    
    contentContainer.innerHTML = `
      <div class="content-viewer-ui-loading">
        <p>Processing content...</p>
      </div>
    `;
    
    try {
      const structured = window.ContentViewer.formatExtractedContent(pageContent);
      const html = window.ContentViewer.generateContentViewerHTML(structured);
      
      contentContainer.innerHTML = html;
      
      window.ContentViewer.attachContentViewerEvents(contentContainer);
    } catch (error) {
      console.error('CocBot: Error rendering content viewer', error);
      contentContainer.innerHTML = `
        <div class="content-viewer-ui-error">
          <p>Error processing content: ${error.message}</p>
        </div>
      `;
    }
  }
  
  /**
   * Request page content refresh
   */
  function refreshContent() {
    // Show loading indicator
    const contentContainer = document.getElementById(`${containerId}-content`);
    contentContainer.innerHTML = `
      <div class="content-viewer-ui-loading">
        <p>Refreshing page content...</p>
      </div>
    `;
    
    // Request new content from content script via sidebar
    window.parent.postMessage({ action: 'get_page_content' }, '*');
  }

  // update the viewer
  function updateContent(pageContent) {
    currentData = pageContent;
    if (container.style.display !== 'none') {
      renderContent(pageContent);
    }
  }
  
  // return public methods
  return {
    show: showViewer,
    hide: hideViewer,
    update: updateContent,
    refresh: refreshContent,
    isVisible: () => container.style.display !== 'none',
    getCurrentData: () => currentData
  };
}

// style shit
function injectContentViewerStyles() {
  const styleId = 'content-viewer-ui-styles';
  
  // Only inject once
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .content-viewer-ui-container {
      display: none;
      flex-direction: column;
      height: 100%;
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background-color: #fff;
      z-index: 100;
      overflow: hidden;
    }
    
    .content-viewer-ui-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background-color: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    
    .content-viewer-ui-toolbar h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: #2c3e50;
    }
    
    .content-viewer-ui-actions {
      display: flex;
      align-items: center;
    }
    
    .content-viewer-ui-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
      margin-left: 5px;
      font-size: 16px;
      color: #666;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .content-viewer-ui-button:hover {
      background-color: #e9ecef;
      color: #333;
    }
    
    .content-viewer-ui-content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }
    
    .content-viewer-ui-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100px;
      color: #666;
      font-size: 14px;
    }
    
    .content-viewer-ui-error {
      padding: 15px;
      color: #e74c3c;
      text-align: center;
      margin: 20px;
      background-color: #fdf0ef;
      border-radius: 4px;
    }
  `;
  
  document.head.appendChild(style);
}

// Export the module
window.ContentViewerUI = {
  init: initContentViewer,
  injectStyles: injectContentViewerStyles
}; 