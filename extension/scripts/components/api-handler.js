import {
  state,
  getApiKey,
  increaseAnonQueryCount,
  getUserSession,
  resetCurrentChatState,
  sendRequest,
} from "./state.js";
import {
  addMessageToChat,
  addTypingIndicator,
  removeTypingIndicator,
} from "./ui-handler.js";
import { elements } from "./dom-elements.js";
import { isSignInNeeded } from "./auth-handler.js";
import idbHandler from "./idb-handler.js";
import chatHandler from "./chat-handler.js";

const SERVER_URL = "http://localhost:3000";

// Process a user query
// TODO: Still response with error when db operations failed
export async function processUserQuery(query) {
  // Anonymous user query limit check
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

  addMessageToChat(query, "user");
  const typingIndicator = addTypingIndicator();

  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      removeTypingIndicator(typingIndicator);
      addMessageToChat(
        "Hey, I need your OpenAI API key to work. Add it in settings.",
        "assistant"
      );
      elements.apiKeyContainer.style.display = "flex";
      return;
    }

    const messages = await constructPromptWithPageContent(
      query,
      state.pageContent,
      state.currentChat.history,
      state.currentConfig
    );

    const response = await callOpenAI(messages);

    removeTypingIndicator(typingIndicator);

    const userSession = await getUserSession();

    if (response.success) {
      const assistantMessage = response.message;

      // Show assistant message immediately (before persistence)
      addMessageToChat(assistantMessage, "assistant");

      // Update history stack
      state.currentChat.history.push({ role: "user", content: query });
      state.currentChat.history.push({
        role: "assistant",
        content: assistantMessage,
      });

      if (state.currentChat.history.length > 6) {
        state.currentChat.history = state.currentChat.history.slice(
          state.currentChat.history.length - 6
        );
      }

      // Persist if user is authenticated
      if (userSession && userSession.id) {
        try {
          let chatId = state.currentChat.id;
          let isNewChat = false;
          if (!chatId) {
            chatId = crypto.randomUUID();
            const pageUrl = state.pageContent?.url || window.location.href;
            const pageTitle = state.pageContent?.title || document.title;

            state.currentChat.id = chatId;
            state.currentChat.title = pageTitle;
            state.currentChat.pageUrl = pageUrl;
            state.currentChat.history = [];
            isNewChat = true;
          }

          if (isNewChat) {
            await chatHandler.createChat({
              id: chatId,
              page_url: state.currentChat.pageUrl,
              title: state.currentChat.title,
            });
            await idbHandler.addChat({
              id: chatId,
              title: state.currentChat.title,
              page_url: state.currentChat.pageUrl,
            });

            state.chatHistory.unshift({
              id: chatId,
              title: state.currentChat.title,
              page_url: state.currentChat.pageUrl,
              created_at: Date.now(),
            });
          }

          // Save user and assistant messages
          await chatHandler.addMessage(chatId, {
            role: "user",
            content: query,
          });
          await chatHandler.addMessage(chatId, {
            role: "assistant",
            content: assistantMessage,
            model: "gpt-4o-mini",
          });

          await idbHandler.addMessageToChat(chatId, {
            role: "user",
            content: query,
          });
          await idbHandler.addMessageToChat(chatId, {
            role: "assistant",
            content: assistantMessage,
          });
        } catch (err) {
          console.warn("Persistence failed:", err);
          // Optionally handle persistence failure (retry/queue)
        }
      } else {
        // Increase anon query count if not signed in
        await increaseAnonQueryCount();
      }
    } else {
      addMessageToChat("Oops, got an error: " + response.error, "assistant");
      if (state.currentChat.history.length <= 0) {
        resetCurrentChatState();
      }
    }
  } catch (error) {
    console.error("CocBot: Query error:", error);
    removeTypingIndicator(typingIndicator);
    addMessageToChat("Something went wrong. Try again?", "assistant");
    if (state.currentChat.history.length <= 0) {
      resetCurrentChatState();
    }
  }
}

// openai api communication
export async function callOpenAI(messages) {
  const config = state.currentConfig || {};
  const maxTokens = config.maxWordCount
    ? Math.ceil(config.maxWordCount * 1.3)
    : 1500;

  const res = await sendRequest(`${SERVER_URL}/api/query/ask`, {
    method: "POST",
    body: {
      messages,
      max_tokens: maxTokens,
    },
  });

  console.log("Query response: ", res);

  return { success: res.success, message: res.data.message };
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
