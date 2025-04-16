//all on client slides 

// DOM Elements
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const closeButton = document.getElementById('close-sidebar');
const settingsButton = document.getElementById('settings-button');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyButton = document.getElementById('save-api-key');
const apiKeyContainer = document.querySelector('.api-key-container');

let apiKey = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  // load API key from storage (session-based)
  chrome.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
    if (response && response.apiKey) {
      apiKey = response.apiKey;
      apiKeyInput.value = '********'; // mask the actual key user input --> prevents visual leak
      
      apiKeyContainer.style.display = 'none';
      
      addAssistantMessage('Hello! I\'m your CocCoc_ISAL assistant. How can I help you today?');
    } else {
      addAssistantMessage('Welcome! Please enter your OpenAI API key to get started.');
    }
  });
  
  // auto-resize textarea hehe
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
  });
  
  // enter key to send message (Shift+Enter for new line)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      chatForm.dispatchEvent(new Event('submit'));
    }
  });
});

// basic event listeners
chatForm.addEventListener('submit', handleSubmit);
closeButton.addEventListener('click', closeSidebar);
settingsButton.addEventListener('click', openSettings);
saveApiKeyButton.addEventListener('click', saveApiKey);

// Handle form submission --> user input
function handleSubmit(e) {
  e.preventDefault();
  
  const message = userInput.value.trim();
  if (!message) return;
  
  // Check if API key is set
  if (!apiKey) {
    addAssistantMessage('Please enter your OpenAI API key first.');
    apiKeyContainer.style.display = 'flex';
    return;
  }
  
  addUserMessage(message);
  
  userInput.value = '';
  userInput.style.height = 'auto';
  
  // Update chat history
  chatHistory.push({ role: 'user', content: message });
  
  // show typing indicator
  const typingIndicator = addTypingIndicator();
  
  window.parent.postMessage({ action: 'get_page_content' }, '*');
  
  // prep streaming response
  streamChatResponse(typingIndicator);
}

function closeSidebar() {
  window.parent.postMessage({ action: 'close_sidebar' }, '*');
}

function openSettings() {
  chrome.runtime.sendMessage({ action: 'openSettings' });
}

// Toggle API key input visibility
function toggleApiKeyInput() {
  if (apiKeyContainer.style.display === 'none') {
    apiKeyContainer.style.display = 'flex';
  } else {
    apiKeyContainer.style.display = 'none';
  }
}

function saveApiKey() {
  const newApiKey = apiKeyInput.value.trim();
  
  if (!newApiKey) {
    alert('Please enter a valid API key');
    return;
  }
  
  // Don't resave the masked key -- prevents overloading
  if (newApiKey === '********' && apiKey) {
    apiKeyContainer.style.display = 'none';
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'saveApiKey', 
    apiKey: newApiKey 
  }, (response) => {
    if (response && response.success) {
      apiKey = newApiKey;
      apiKeyInput.value = '********'; 
      apiKeyContainer.style.display = 'none'; // Hide the input after saving
      
      if (chatContainer.children.length <= 1) {
        addAssistantMessage('Hello! I\'m your CocCoc_ISAL assistant. How can I help you today?');
      } else {
        addAssistantMessage('API key saved! You can now continue chatting.');
      }
    }
  });
}

// Add a user message to the chat
function addUserMessage(content) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message user-message';
  messageElement.textContent = content;
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Add an assistant message to the chat
function addAssistantMessage(content) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message assistant-message';
  messageElement.textContent = content;
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Update chat history
  chatHistory.push({ role: 'assistant', content });
}

// Add typing indicator
function addTypingIndicator() {
  const messageElement = document.createElement('div');
  messageElement.className = 'message assistant-message';
  
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.innerHTML = 'Thinking<span></span><span></span><span></span>';
  
  messageElement.appendChild(typingIndicator);
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return messageElement;
}

// chatting core fucntion w streaming
async function streamChatResponse(typingIndicatorElement) {
  try {
    const messages = [...chatHistory];
    
    if (!messages.some(msg => msg.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: 'You are a helpful AI assistant embedded in a browser extension. Provide concise, relevant answers.'
      });
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        stream: true
      })
    });
    
    // basic ass error handling
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Unknown error occurred');
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message assistant-message';
    chatContainer.replaceChild(messageElement, typingIndicatorElement);
    
    let fullResponse = '';
    
    // StreamProcessing via reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // decode chunks
      const chunk = decoder.decode(value);
      
      // Process each line (each SSE event) --> stream deez
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            const content = data.choices[0]?.delta?.content || '';
            
            if (content) {
              fullResponse += content;
              messageElement.textContent = fullResponse;
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
    
    chatHistory.push({ role: 'assistant', content: fullResponse });
    
  } catch (error) {
    // openai error if persists
    console.error('Error calling OpenAI API:', error);
    const errorMessage = error.message || 'Error communicating with OpenAI. Please check your API key.';
    chatContainer.removeChild(typingIndicatorElement);
    addAssistantMessage(`Error: ${errorMessage}`);
    
    //authentication error
    if (errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('auth')) {
      apiKeyContainer.style.display = 'flex';
    }
  }
}

// Listen for messages from content script via postMessage
window.addEventListener('message', (event) => {

  if (event.source !== window.parent) return;
  
  const message = event.data;
  
  if (message.action === 'page_content') {
    const pageContext = message.content;
    
    chatHistory.push({
      role: 'system',
      content: `The user is currently on the page titled "${pageContext.title}" at URL ${pageContext.url}. ${
        pageContext.selection ? `They have selected the following text: "${pageContext.selection}"` : ''
      }`
    });
  }
}); 