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
  updateMessageWithId,
} from "./ui-handler.js";
import { isSignInNeeded } from "./auth-handler.js";
import idbHandler from "./idb-handler.js";
import chatHandler from "./chat-handler.js";
import { RequestQueue } from "../../components/RequestQueue.js";

const SERVER_URL = "https://dev-capstone-2025.coccoc.com";

/**
 * Generate response for query by sending a request to the backend server
 * @param {String} query Query
 * @param {Object} metadata Metadata
 * @returns
 */
export async function processUserQuery(query, metadata = {}) {
  // Prevent spams
  if (state.isProcessingQuery) return;

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
    // Build prompt
    const messages = await constructPromptWithPageContent(
      query,
      state.pageContent,
      state.currentChat.history,
      state.currentConfig
    );

    metadata.page_url = state.pageContent?.url || window.location.href;

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
  // Increase anonymous session's query count
  if (!userSession || !userSession.id) {
    await increaseAnonQueryCount();
    return;
  }

  const pageUrl = state.pageContent?.url || window.location.href;
  const pageTitle = state.pageContent?.title || document.title;

  const currentChatId = state.currentChat.id;
  const isNewChat = !currentChatId;
  try {
    let chatId = currentChatId;

    // Create a new chat if needed
    if (isNewChat) {
      const result = await chatHandler.createChat({
        page_url: pageUrl,
        title: pageTitle,
      });
      if (!result?.success || !result?.data.id)
        throw new Error("Failed to create chat");

      chatId = result.data.id;

      // Update current chat state to new chat
      if (!state.currentChat.id) {
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
    }

    // Store messages and get their IDs back
    const userMessageResult = await chatHandler.addMessage(chatId, {
      role: "user",
      content: userQuery,
    });

    const assistantMessageResult = await chatHandler.addMessage(chatId, {
      role: "assistant",
      content: assistantMessage,
      model,
    });

    // Update the message element with real message ID
    if (assistantMessageResult?.success && assistantMessageResult?.data?.id) {
      updateMessageWithId(tempMessageId, assistantMessageResult.data.id);
    }

    // Cache locally
    await idbHandler.addMessageToChat(chatId, {
      role: "user",
      content: userQuery,
    });
    await idbHandler.addMessageToChat(chatId, {
      role: "assistant",
      content: assistantMessage,
    });

    // Insert new chat into local chat history list after messages are processed successfuly
    if (isNewChat) {
      state.chatHistory.unshift({
        id: chatId,
        title: pageTitle,
        page_url: pageUrl,
        created_at: Date.now(),
      });
    }
  } catch (error) {
    console.error("Failed to persist messages:", error);
    // Handle error - maybe show a retry option or remove feedback icon
  }
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

export async function constructPromptWithPageContent(
  query,
  pageContent,
  history,
  config
) {
  // Set default values if config is missing
  const maxWordCount = config?.maxWordCount || 150;
  const responseStyle = config?.responseStyle || "conversational";
  const language = state.language || "en";

  // Customize instructions based on response style
  let styleInstructions = "";
  switch (responseStyle) {
    case "conversational":
      styleInstructions = `Use a friendly, conversational tone with everyday language.
Explain concepts in simple terms that are easy to understand.
Keep your response around ${maxWordCount} words.`;
      break;
    case "educational":
      styleInstructions = `Present information in a structured, educational format.
Include clear explanations with examples where helpful.
Organize your response with logical flow and keep it around ${maxWordCount} words.`;
      break;
    case "technical":
      styleInstructions = `Use precise terminology and provide thorough analysis.
Include technical details appropriate for someone with domain knowledge.
Maintain accuracy and depth while keeping your response around ${maxWordCount} words.`;
      break;
    default:
      styleInstructions = `Keep your response around ${maxWordCount} words.`;
  }

  // language instructions
  let languageInstructions = "";
  if (language === "vi") {
    languageInstructions = `Respond entirely in Vietnamese. Use natural, fluent Vietnamese expressions and terminology.`;
  } else {
    languageInstructions = `Respond in English.`;
  }

  const systemPrompt = {
    role: "system",
    content: `You are a helpful assistant that helps users understand web page content.
You have access to the content of the page the user is currently viewing, which is provided below.
Answer the user's questions based on this content. If the answer is not in the content, say so.
${languageInstructions}
${config?.personality || "Be helpful and informative, focusing on the content."}
${styleInstructions}`,
  };

  let contextMessage = {
    role: "system",
    content: "PAGE CONTENT:\n",
  };

  if (pageContent) {
    if (pageContent.extractionSuccess === false) {
      contextMessage.content +=
        "Note: Limited page content extracted. I'll work with what's available.\n\n";
    }

    contextMessage.content += `Title: ${pageContent.title || "Unknown"}\n`;
    contextMessage.content += `URL: ${pageContent.url || "Unknown"}\n\n`;

    if (pageContent.content) {
      contextMessage.content += pageContent.content;
    } else {
      contextMessage.content +=
        "The page content extraction failed. I have limited context about this page.";
    }

    if (pageContent.captions && pageContent.captions.length > 0) {
      contextMessage.content +=
        "\n\nNote: Some image captions were extracted to help explain the visuals on this page. These are supplementary and not part of the page's actual content structure.\n";

      pageContent.captions.forEach((caption, index) => {
        contextMessage.content += `• Image ${index + 1}: ${caption}\n`;
      });
    }
  } else {
    contextMessage.content +=
      "No page content was provided. I don't have specific context about what you're viewing.";
  }

  let messages = [systemPrompt, contextMessage];

  if (history && history.length > 0) {
    messages = messages.concat(history);
  }

  messages.push({
    role: "user",
    content: query,
  });

  return messages;
}

/**
 *
 * @param {string} pageContent Page content
 * @returns {Promise<{success: boolean, questions: string[]}>}
 */
export async function generateQuestionsFromContent(pageContent) {
  if (!pageContent || !pageContent.content) {
    return { success: false, error: "No content available" };
  }

  try {
    // Call backend API instead of OpenAI directly
    const language = state.language || "en";
    const res = await sendRequest(
      `${SERVER_URL}/api/query/suggested-questions`,
      {
        method: "POST",
        body: {
          pageContent,
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
    } else {
      return {
        success: false,
        error: res.error.message || "Failed to extract questions",
      };
    }
  } catch (error) {
    console.error("CocBot: Error generating questions", error);
    return { success: false, error: error.message };
  }
}
