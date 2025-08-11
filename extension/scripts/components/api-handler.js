import {
  state,
  increaseAnonQueryCount,
  getUserSession,
  resetCurrentChatState,
  sendRequest,
} from "./state.js";
import {
  addMessageToChat,
  addTypingIndicator,
  removeTypingIndicator,
  showToast,
  updateMessageWithId,
} from "./ui-handler.js";
import { isSignInNeeded } from "./auth-handler.js";
import idbHandler from "./idb-handler.js";
import chatHandler from "./chat-handler.js";
import { formatPdfContent } from "./pdf-handler.js";

const SERVER_URL = "http://localhost:3000";

/**
 * Generate response for query by sending a request to the backend server
 * @param {String} query Query
 * @param {Object} metadata Metadata
 * @param {String} [metadata.event]
 * @returns
 */
export async function processUserQuery(query, metadata = { event: "ask" }) {
  // Prevent spams
  if (state.isProcessingQuery) return;

  // Check if user is online
  if (navigator.onLine === false) {
    showToast({
      message: "You are offline. Please check your internet connection.",
      type: "error",
      duration: 2000,
    });

    return;
  }

  // Check if we have page content ready
  if (!state.pageContent || !state.pageContent.extractionSuccess) {
    return addMessageToChat({
      message: "Page content is still being extracted. Please wait a moment.",
      role: "assistant",
    });
  }

  const notAllowed = await isSignInNeeded();
  if (notAllowed) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "sign_in_required",
        });
      }
    });
    return;
  }

  // Show user prompt with thinking indicator
  addMessageToChat({
    message: query,
    role: "user",
    event: metadata.event,
  });

  const typingIndicator = addTypingIndicator();
  state.isProcessingQuery = true;

  try {
    // Decide if should use live page content or chat history
    const pageContext = {
      ...(state.isUsingChatContext ? state.chatContext : state.pageContent),
    };

    // Attach PDF content if available
    if (
      !state.isUsingChatContext &&
      state.pdfContent &&
      state.pdfContent.content
    ) {
      pageContext.pdfContent = state.pdfContent;
    }

    // Build prompt
    console.log("Current context: ", pageContext);
    const messages = constructPromptWithPageContent({
      query,
      pageContent: pageContext,
      history: state.currentChat.history,
      config: state.currentConfig,
      language: state.language,
    });

    // Get response
    const response = await callOpenAI(messages, metadata);
    removeTypingIndicator(typingIndicator);

    if (response.success) {
      const assistantMessage = response.message;

      // Show assistant response immediately with temporary ID
      const tempMessageId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const messageElement = addMessageToChat({
        message: assistantMessage,
        role: "assistant",
        tempMessageId,
      });

      // Update current chat history for context-aware responses
      state.currentChat.history.push({ role: "user", content: query });
      state.currentChat.history.push({
        role: "assistant",
        content: assistantMessage,
      });

      if (state.currentChat.history.length > 6) {
        state.currentChat.history = state.currentChat.history.slice(-6);
      }

      // Persist and get real message IDs, then update the UI
      persistChatAndMessages(
        query,
        assistantMessage,
        response.model,
        tempMessageId
      );

      if (metadata.event === "summarize") {
        persistPageSummary(assistantMessage);
      }

      return { success: true, message: assistantMessage };
    } else {
      addMessageToChat({
        message: `Oops, got an error: ${response.error}`,
        role: "assistant",
      });
      if (state.currentChat.history.length <= 0) {
        resetCurrentChatState();
      }
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error("CocBot: Query error:", error);
    removeTypingIndicator(typingIndicator);
    addMessageToChat({
      message: "Something went wrong. Try again?",
      role: "assistant",
    });
    if (state.currentChat.history.length <= 0) {
      resetCurrentChatState();
    }
    return { success: false, error: error.message };
  } finally {
    state.isProcessingQuery = false;
  }
}

/**
 *
 * @param {String} userQuery
 * @param {String} assistantMessage
 * @param {String} model
 * @param {String} tempMessageId
 * @returns
 */
async function persistChatAndMessages(
  userQuery,
  assistantMessage,
  model,
  tempMessageId
) {
  const userSession = await getUserSession();
  if (!userSession || !userSession.id) {
    await increaseAnonQueryCount();
    return;
  }

  const pageUrl = state.pageContent.url;
  const pageTitle = state.pageContent.title;

  const currentChatId = state.currentChat.id;
  const isNewChat = !currentChatId;

  let chat;
  try {
    let chatId = currentChatId;

    // If is a new chat, send request to create a new chat
    if (isNewChat) {
      const result = await chatHandler.createChat({
        page_url: pageUrl,
        title: pageTitle,
      });

      if (!result.success || !result.data) {
        return;
      }

      // Assign values to chatId
      chat = result.data.chat;
      chatId = chat.id;

      // Update current chat state
      state.currentChat.id = chatId;
      state.currentChat.title = pageTitle;
      state.currentChat.pageUrl = pageUrl;
      state.currentChat.history = [];

      await idbHandler.upsertChat({
        id: chatId,
        title: pageTitle,
        page_url: pageUrl,
      });
    }

    const userMessageResult = await chatHandler.addMessage(chatId, {
      role: "user",
      content: userQuery,
    });

    const assistantMessageResult = await chatHandler.addMessage(chatId, {
      role: "assistant",
      content: assistantMessage,
      model,
    });

    if (assistantMessageResult?.success && assistantMessageResult?.data?.id) {
      updateMessageWithId(tempMessageId, assistantMessageResult.data.id);
    }

    await idbHandler.addMessageToChat(chatId, {
      role: "user",
      content: userQuery,
    });
    await idbHandler.addMessageToChat(chatId, {
      role: "assistant",
      content: assistantMessage,
    });

    if (isNewChat && chat) {
      state.chatHistory.unshift(chat);
    }
  } catch (error) {
    console.error("Failed to persist messages:", error);
  }
}

/**
 * Persist page summary
 * @param {String} assistantMessage
 */
async function persistPageSummary(assistantMessage) {
  const isChatContext = state.isUsingChatContext;
  const contentSource = isChatContext ? state.chatContext : state.pageContent;

  if (!contentSource) return;

  chrome.runtime.sendMessage({
    action: "store_page_summary",
    page_url: contentSource.url,
    summary: assistantMessage,
    language: state.language,
  });
}

/**
 * Send a request to the backend server
 * @param {Object} messages OpenAI instructions and query
 * @param {Object} metadata Metadata
 * @returns {Promise<{success: Boolean, message: String, model: String}>}
 */
export async function callOpenAI(messages, metadata) {
  const config = state.currentConfig || {};
  const maxTokens = config.maxWordCount
    ? Math.ceil(config.maxWordCount * 1.3)
    : 1500;
  metadata.max_tokens = maxTokens;
  metadata.page_url = state.isUsingChatContext
    ? state.chatContext.url
    : state.pageContent?.url || window.location.href;
  metadata.language = state.language || "en";

  const res = await sendRequest(`${SERVER_URL}/api/query/ask`, {
    method: "POST",
    body: {
      messages,
      metadata,
    },
  });

  console.log("Query response: ", res);

  return {
    success: res.success,
    message: res.data.message,
    model: res.data.model,
  };
}

/**
 * Constructs a prompt for AI response based on query, page content, and history.
 * @param {Object} options
 * @param {string} options.query User input/question.
 * @param {Object} options.pageContent Page content context
 * @param {Array} options.history
 * @param {Object} options.config
 * @param {string} [options.language]
 * @returns {Array} Array of messages to send to AI.
 */
export function constructPromptWithPageContent(options) {
  const {
    query,
    pageContent,
    history = [],
    config = {},
    language = "en",
  } = options;

  const maxWordCount = config.maxWordCount || 150;
  const responseStyle = config.responseStyle || "conversational";

  const styleInstructions = getStyleInstructions(responseStyle, maxWordCount);
  const languageInstructions = getLanguageInstructions(language);
  const personalityInstructions =
    config.personality ||
    "Be helpful and informative, focusing on the content.";

  const systemPrompt = {
    role: "system",
    content: [
      "You are a helpful assistant that helps users understand web page content.",
      "You have access to the content of the page the user is currently viewing, which is provided below.",
      "Answer the user's questions based on this content. If the answer is not in the content, say so.",
      languageInstructions,
      personalityInstructions,
      styleInstructions,
    ].join("\n\n"),
  };

  const contextMessage = generateContextMessage(pageContent);
  console.log("Context message: ", contextMessage);

  // Keep 6 recent messages
  const trimmedHistory = history.slice(-6);

  return [
    systemPrompt,
    contextMessage,
    ...trimmedHistory,
    {
      role: "user",
      content: query,
    },
  ];
}

/**
 * Helper function to get style instructions based on selected style and max words.
 * @param {String} style
 * @param {number} maxWords
 * @returns Style instructions based on the selected style and max words
 */
function getStyleInstructions(style, maxWords) {
  const styles = {
    conversational: `Use a friendly, conversational tone with everyday language.
Explain concepts in simple terms that are easy to understand.
Keep your response around ${maxWords} words.`,
    educational: `Present information in a structured, educational format.
Include clear explanations with examples where helpful.
Organize your response with logical flow and keep it around ${maxWords} words.`,
    technical: `Use precise terminology and provide thorough analysis.
Include technical details appropriate for someone with domain knowledge.
Maintain accuracy and depth while keeping your response around ${maxWords} words.`,
  };
  return styles[style] || `Keep your response around ${maxWords} words.`;
}

/**
 * Get language-specific instructions for AI responses.
 * @param {String} lang The language code
 * @returns {String} Language instructions for the AI.
 */
function getLanguageInstructions(lang) {
  return lang === "vi"
    ? "Respond entirely in Vietnamese. Use natural, fluent Vietnamese expressions and terminology."
    : "Respond in English.";
}

/**
 * Generate a context message for the AI based on the page content.
 * @param {Object} pageContent
 * @returns {Object} OpenAI chat message object
 */
function generateContextMessage(pageContent) {
  console.log("pageContent in generateContextMessage: ", pageContent);
  const message = {
    role: "system",
    content: "PAGE CONTENT:\n",
  };

  if (!pageContent) {
    message.content +=
      "No page content was provided. I don't have specific context about what you're viewing.";
    return message;
  }

  const {
    title = "Unknown",
    url = "Unknown",
    content = "",
    captions = [],
    extractionSuccess = true,
    pdfContent = null,
  } = pageContent;

  if (!extractionSuccess) {
    message.content +=
      "Note: Limited page content extracted. I'll work with what's available.\n\n";
  }

  message.content += `Title: ${title}\nURL: ${url}\n\n`;
  message.content +=
    content ||
    "The page content extraction failed. I have limited context about this page.";

  if (captions.length > 0) {
    message.content +=
      "\n\nNote: Some image captions were extracted to help explain the visuals on this page.\n";
    captions.forEach((caption, index) => {
      message.content += `• Image ${index + 1}: ${caption}\n`;
    });
  }

  // Handle PDF content
  if (pdfContent?.content) {
    message.content += `\n\n--- Extracted PDF Document ---\n`;

    const formattedPdf = formatPdfContent(state.pdfContent);

    if (formattedPdf) {
      // Use first 5000 characters
      message.content += formattedPdf.slice(0, 5000);
    }
  }

  return message;
}

/**
 * Generate questions based on current context (live page or chat)
 * @param {Object} [contentOverride] Optional manual override of content
 * @returns {Promise<{success: boolean, questions?: string[], error?: string}>}
 */
export async function generateQuestionsFromContent(contentOverride = null) {
  // Check internet connection
  if (!navigator.onLine) {
    showToast({
      message: "You are offline. Please check your internet connection.",
      type: "error",
      duration: 2000,
    });
    return;
  }

  // Ensure we have extracted page content
  if (!state.pageContent || !state.pageContent.extractionSuccess) {
    return addMessageToChat({
      message: "Page content is still being extracted. Please wait a moment.",
      role: "assistant",
    });
  }

  // Determine the base content source
  const baseContent =
    contentOverride ||
    (state.isUsingChatContext ? state.chatContext : state.pageContent);

  if (!baseContent || !baseContent.content) {
    return { success: false, error: "No content available" };
  }

  // Clone content object to avoid accidental mutations
  const contentSource = { ...baseContent };

  // Inject pdfContent (as string) if available
  if (state.isUsingChatContext) {
    if (
      contentSource.pdfContent &&
      typeof contentSource.pdfContent === "object" &&
      contentSource.pdfContent.content
    ) {
      contentSource.pdfContent = contentSource.pdfContent.content.slice(
        0,
        5000
      );
    }
  } else if (state.pdfContent && state.pdfContent.content) {
    const formattedPdfContent = formatPdfContent(state.pdfContent);
    contentSource.pdfContent = formattedPdfContent.slice(0, 5000);
  }

  state.isGeneratingQuestions = true;

  try {
    const language = state.language || "en";

    const res = await sendRequest(
      `${SERVER_URL}/api/query/suggested-questions`,
      {
        method: "POST",
        body: {
          pageContent: contentSource,
          language,
        },
      }
    );

    if (
      res.success &&
      Array.isArray(res.data.questions) &&
      res.data.questions.length > 0
    ) {
      return {
        success: true,
        questions: res.data.questions.slice(0, 3),
      };
    }

    return {
      success: false,
      error: res.error?.message || "Failed to extract questions",
    };
  } catch (error) {
    console.error("CocBot: Error generating questions", error);
    return { success: false, error: error.message };
  } finally {
    state.isGeneratingQuestions = false;
  }
}
