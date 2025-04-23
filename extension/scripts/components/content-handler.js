// handles page content extraction and rendering
import { elements } from './dom-elements.js';
import { state } from './state.js';
import { switchToChat } from './ui-handler.js';
import { generateQuestionsFromContent, processUserQuery } from './api-handler.js';

// request page content from background script
export function requestPageContent() {
  console.log('CocBot: Requesting page content');
  
  // reset questions
  state.generatedQuestions = null;
  const questionsContainer = document.querySelector('.generated-questions');
  if (questionsContainer) {
    questionsContainer.style.display = 'none';
  }
  
  // track attempts
  state.contentFetchAttempts++;
  
  chrome.runtime.sendMessage({ action: 'extract_page_content' }, (response) => {
    if (response && response.success) {
      console.log('CocBot: Got page content!');
      state.pageContent = response.content;
      
      // update ui
      updateContentStatus();
      
      // reset counter on success
      state.contentFetchAttempts = 0;
    } else {
      console.log('CocBot: No content yet, will try again', state.contentFetchAttempts, 'of', state.maxContentFetchAttempts);
      
      // retry up to max attempts
      if (state.contentFetchAttempts < state.maxContentFetchAttempts) {
        setTimeout(() => {
          requestPageContent();
        }, 2000);
      }
    }
  });
}

// display content in sidebar
export function renderContentInSidebar(content) {
  if (!content) {
    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-ui-error">
        <p>No content found. Try refreshing.</p>
      </div>
    `;
    return;
  }
  
  try {
    // format using contentviewer
    const structured = window.ContentViewer.formatExtractedContent(content);
    const html = window.ContentViewer.generateContentViewerHTML(structured);
    
    // show it
    elements.contentDisplay.innerHTML = html;
    
    // wire up interactions
    window.ContentViewer.attachContentViewerEvents(elements.contentDisplay);
  } catch (error) {
    console.error('CocBot: Error showing content', error);
    elements.contentDisplay.innerHTML = `
      <div class="content-viewer-ui-error">
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
}

// open content viewer popup
export function openContentViewerPopup() {
  console.log('CocBot: Showing content viewer');
  
  // hide other screens
  elements.welcomeScreen.style.display = 'none';
  elements.chatScreen.style.display = 'none';
  
  // show viewer
  elements.contentViewerScreen.style.display = 'flex';
  elements.contentViewerScreen.style.flexDirection = 'column';
  elements.contentViewerScreen.style.height = '100%';
  elements.contentDisplay.style.flex = '1';
  elements.contentDisplay.style.overflowY = 'auto';
  
  // show spinner
  elements.contentDisplay.innerHTML = `
    <div class="content-viewer-loading">
      <div class="spinner"></div>
      <p>Processing page content...</p>
    </div>
  `;
  
  if (!state.pageContent) {
    console.log('CocBot: No content yet, getting it');
    
    // try to extract content
    chrome.runtime.sendMessage({ action: 'extract_page_content' }, (response) => {
      if (response && response.success) {
        console.log('CocBot: Got the content!');
        state.pageContent = response.content;
        renderContentInSidebar(state.pageContent);
      } else {
        console.error('CocBot: Failed to get content', response?.error);
        elements.contentDisplay.innerHTML = `
          <div class="content-viewer-ui-error">
            <p>Couldn't get page content: ${response?.error || "Unknown error"}</p>
          </div>
        `;
      }
    });
    return;
  }
  
  // already have content, show it
  renderContentInSidebar(state.pageContent);
}

// update page context in welcome screen
export function updateContentStatus() {
  // existing welcome screen indicator
  if (state.pageContent) {
    // add page context label
    const welcomeContentElement = document.querySelector('.welcome-content');
    if (welcomeContentElement) {
      // remove any existing indicator first to avoid duplicates
      const existingIndicator = document.querySelector('.page-context-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      const pageContextIndicator = document.createElement('div');
      pageContextIndicator.className = 'page-context-indicator';
      pageContextIndicator.style.fontSize = '12px';
      pageContextIndicator.style.color = 'var(--muted-foreground)';
      pageContextIndicator.style.marginTop = '10px';
      pageContextIndicator.style.textAlign = 'center';
      
      if (state.pageContent.extractionSuccess === false) {
        pageContextIndicator.textContent = `Content extraction issue - using limited context`;
        pageContextIndicator.style.backgroundColor = '#fff4e5';
        pageContextIndicator.style.color = '#b54708';
      } else {
        pageContextIndicator.textContent = `Page context: ${state.pageContent.title.substring(0, 30)}${state.pageContent.title.length > 30 ? '...' : ''}`;
      }
      
      welcomeContentElement.appendChild(pageContextIndicator);
      
      // add a small refresh button next to indicator
      const refreshButton = document.createElement('button');
      refreshButton.className = 'refresh-content-button';
      refreshButton.innerHTML = '↻';
      refreshButton.title = 'Refresh page content';
      refreshButton.style.border = 'none';
      refreshButton.style.background = 'transparent';
      refreshButton.style.cursor = 'pointer';
      refreshButton.style.fontSize = '12px';
      refreshButton.style.marginLeft = '5px';
      refreshButton.onclick = () => {
        state.contentFetchAttempts = 0;
        requestPageContent();
        
        // reset questions
        state.generatedQuestions = null;
        document.querySelector('.generated-questions').style.display = 'none';
      };
      
      pageContextIndicator.appendChild(refreshButton);
      
      // generate questions based on content
      generateAndDisplayQuestions();
    }
  }
  
  // also update chat ui if already in chat mode
  if (!state.welcomeMode && state.pageContent) {
    // add a small indicator at the top of chat
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      // remove any existing indicator first
      const existingChatIndicator = chatContainer.querySelector('.chat-context-indicator');
      if (existingChatIndicator) {
        existingChatIndicator.remove();
      }
      
      // only add if we don't already have messages
      if (chatContainer.querySelectorAll('.chat-message').length === 0) {
        const chatContextIndicator = document.createElement('div');
        chatContextIndicator.className = 'chat-context-indicator';
        chatContextIndicator.style.fontSize = '12px';
        chatContextIndicator.style.opacity = '0.7';
        chatContextIndicator.style.textAlign = 'center';
        chatContextIndicator.style.marginBottom = '10px';
        chatContextIndicator.style.padding = '5px';
        
        if (state.pageContent.extractionSuccess === false) {
          chatContextIndicator.innerHTML = `⚠️ Limited page context available`;
        } else {
          chatContextIndicator.innerHTML = `✓ Page context loaded: <span style="font-style:italic">${state.pageContent.title.substring(0, 25)}${state.pageContent.title.length > 25 ? '...' : ''}</span>`;
        }
        
        chatContainer.prepend(chatContextIndicator);
      }
    }
  }
}

// generate and display questions about the content
export async function generateAndDisplayQuestions() {
  // check if we already have questions
  if (state.generatedQuestions || state.isGeneratingQuestions || !state.pageContent) {
    return;
  }
  
  // get reference to questions container
  const questionsContainer = document.querySelector('.generated-questions');
  const buttonContainer = document.querySelector('.question-buttons-container');
  
  // check if we have the elements
  if (!questionsContainer || !buttonContainer) {
    console.error("CocBot: Missing question container elements");
    return;
  }
  
  // show the container with loading state
  questionsContainer.style.display = 'block';
  
  // set flag to prevent multiple calls
  state.isGeneratingQuestions = true;
  
  try {
    // generate questions
    const result = await generateQuestionsFromContent(state.pageContent);
    
    // clear the loading indicator
    buttonContainer.innerHTML = '';
    
    if (result.success && result.questions && result.questions.length > 0) {
      console.log("CocBot: Successfully generated questions", result.questions);
      
      // save the questions
      state.generatedQuestions = result.questions;
      
      // add each question as a button
      result.questions.forEach(question => {
        const questionButton = document.createElement('button');
        questionButton.className = 'question-button';
        questionButton.textContent = question;
        questionButton.onclick = () => {
          // use the question as a query
          switchToChat();
          processUserQuery(question);
        };
        
        buttonContainer.appendChild(questionButton);
      });
    } else {
      console.error("CocBot: Failed to generate questions", result.error);
      questionsContainer.style.display = 'none';
    }
  } catch (error) {
    console.error("CocBot: Error in generating questions", error);
    questionsContainer.style.display = 'none';
  } finally {
    state.isGeneratingQuestions = false;
  }
}

// setup improved content extraction reliability
export function setupContentExtractionReliability() {
  // listen for page changes and refresh content accordingly
  setInterval(() => {
    if (document.visibilityState === 'visible' && !state.pageContent) {
      console.log('CocBot: No content and tab is visible, retrying extraction');
      state.contentFetchAttempts = 0; // reset counter
      requestPageContent();
    }
  }, 5000);
  
  // add a debug button in dev mode
  if (location.hostname === 'localhost' || location.search.includes('debug=true')) {
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Content';
    debugButton.style.position = 'absolute';
    debugButton.style.bottom = '10px';
    debugButton.style.right = '10px';
    debugButton.style.zIndex = '9999';
    debugButton.onclick = () => {
      state.contentFetchAttempts = 0;
      requestPageContent();
      alert('Content debug: ' + (state.pageContent ? 'Content available' : 'No content'));
      console.log('Content debug:', state.pageContent);
    };
    document.body.appendChild(debugButton);
  }
} 