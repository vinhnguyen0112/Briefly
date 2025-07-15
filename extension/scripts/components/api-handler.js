import {
  state,
  getUserSession,
  resetCurrentChatState,
  sendRequest,
} from "./state.js";
import {
  addMessageToChat,
  addTypingIndicator,
  removeTypingIndicator,
} from "./ui-handler.js";
import { isSignInNeeded } from "./auth-handler.js";
import idbHandler from "./idb-handler.js";

const SERVER_URL = "http://localhost:3000";

/**
 * Generate response for query by sending a request to the backend server
 * @param {String} query Query
 * @param {Object} options Options
 * @returns
 */
export async function processUserQuery(query, options = { event: "ask" }) {
  // Check if user need to sign in to continue
  const notAllowed = await isSignInNeeded();
  if (notAllowed) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "sign_in_required" });
      }
    });
    return;
  }

  // Add user prompt into chat screen
  addMessageToChat(query, "user");
  const typingIndicator = addTypingIndicator();

  try {
    // Build prompt
    const messages = await constructPromptWithPageContent(
      query,
      state.pageContent,
      state.currentChat.history,
      state.currentConfig
    );

    // Prepare chat metadata for backend
    const chatMeta = {
      chat_id: state.currentChat.id || null,
      page_url: state.pageContent?.url || window.location.href,
      title: state.pageContent?.title || document.title,
      user_query: query, // User prompt
      should_create_chat: !state.currentChat.id, // true if new chat
      event: options.event,
    };

    // Send everything to backend
    const response = await callOpenAI(messages, chatMeta);

    removeTypingIndicator(typingIndicator);

    if (response.success) {
      // Add AI-generated response to chat screen
      const assistantMessage = response.message;
      addMessageToChat(assistantMessage, "assistant");

      const authSession = await getUserSession();

      // Only persist chat & messages for authenticated session
      if (authSession && authSession.id) {
        if (response.chat_id && !state.currentChat.id) {
          // If backend response back with a newly created chat,
          // update state & push it into history
          state.currentChat.id = response.chat_id;
          state.currentChat.title = chatMeta.title;
          state.currentChat.pageUrl = chatMeta.page_url;
          state.chatHistory.unshift({
            id: response.chat_id,
            title: chatMeta.title,
            page_url: chatMeta.page_url,
            created_at: Date.now(),
          });

          // Cache chat in IndexedDB
          await idbHandler.upsertChat({
            id: response.chat_id,
            title: chatMeta.title,
            page_url: chatMeta.page_url,
          });
        }

        // Cache messages in IndexedDB
        await idbHandler.addMessageToChat(
          response.chat_id || state.currentChat.id,
          {
            role: "user",
            content: query,
          }
        );

        await idbHandler.addMessageToChat(
          response.chat_id || state.currentChat.id,
          {
            role: "assistant",
            content: response.message,
            model: response.model,
          }
        );
      }

      // Update the chat's history stack regardless
      state.currentChat.history.push({ role: "user", content: query });
      state.currentChat.history.push({
        role: "assistant",
        content: assistantMessage,
      });

      if (state.currentChat.history.length > 6) {
        state.currentChat.history = state.currentChat.history.slice(-6);
      }

      return {
        success: true,
        message: assistantMessage,
        chat_id: response.chat_id,
      };
    } else {
      addMessageToChat("Oops, got an error: " + response.error, "assistant");
      if (state.currentChat.history.length <= 0) resetCurrentChatState();
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error("CocBot: Query error:", error);
    removeTypingIndicator(typingIndicator);
    addMessageToChat("Something went wrong. Try again?", "assistant");
    if (state.currentChat.history.length <= 0) resetCurrentChatState();
    return { success: false, error: error.message };
  }
}

/**
 * Send a request to the backend server
 * @param {Object} messages OpenAI instructions and query
 */
export async function callOpenAI(messages, chatMeta) {
  const config = state.currentConfig || {};
  const maxTokens = config.maxWordCount
    ? Math.ceil(config.maxWordCount * 1.3)
    : 1500;

  const res = await sendRequest(`${SERVER_URL}/api/query/ask`, {
    method: "POST",
    body: {
      messages,
      max_tokens: maxTokens,
      chat_meta: chatMeta,
    },
  });

  console.log("Query response: ", res);

  return {
    success: res.success,
    message: res.data.message,
    chat_id: res.data.chat_id,
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

  console.log("Prompt messages: ", messages);

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
