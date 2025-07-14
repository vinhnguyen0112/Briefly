import {
  state,
  getApiKey,
  increaseAnonQueryCount,
  getUserSession,
  resetCurrentChatState,
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

// Process a user query
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

    const response = await callOpenAI(apiKey, messages);

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

      return { success: true, message: assistantMessage };
    } else {
      addMessageToChat("Oops, got an error: " + response.error, "assistant");
      if (state.currentChat.history.length <= 0) {
        resetCurrentChatState();
      }
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error("CocBot: Query error:", error);
    removeTypingIndicator(typingIndicator);
    addMessageToChat("Something went wrong. Try again?", "assistant");
    if (state.currentChat.history.length <= 0) {
      resetCurrentChatState();
    }

    return { success: false, error: error.message };
  }
}

// openai api communication
export async function callOpenAI(apiKey, messages) {
  try {
    // Estimate max tokens based on config maxWordCount if available
    // Approximate tokens to be ~1.3x the number of words
    const config = state.currentConfig || {};
    const maxTokens = config.maxWordCount
      ? Math.ceil(config.maxWordCount * 1.3)
      : 1500;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Unknown API error");
    }

    if (data.choices && data.choices.length > 0) {
      return {
        success: true,
        message: data.choices[0].message.content,
      };
    } else {
      throw new Error("No response from API");
    }
  } catch (error) {
    console.error("CocBot: API error", error);
    return {
      success: false,
      error: error.message,
    };
  }
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

export async function generateQuestionsFromContent(pageContent) {
  if (!pageContent || !pageContent.content) {
    return { success: false, error: "No content available" };
  }

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: "No API key" };
    }

    const language = state.language || "en";

    let systemPromptContent;
    if (language === "vi") {
      systemPromptContent = `Bạn là một AI tạo ra các câu hỏi thú vị về nội dung trang web.
Hãy tạo 3 câu hỏi bằng tiếng Việt mà sẽ hữu ích cho người đọc trang này.
Phản hồi của bạn CHỈ nên là một mảng gồm 3 câu hỏi tiếng Việt, định dạng dưới dạng mảng JSON các chuỗi.
Ví dụ: ["Câu hỏi 1 bằng tiếng Việt?", "Câu hỏi 2 bằng tiếng Việt?", "Câu hỏi 3 bằng tiếng Việt?"]
Không bao gồm bất kỳ thứ gì khác.`;
    } else {
      systemPromptContent = `You are an AI that generates 3 interesting questions about web page content. 
Generate questions that would be useful to a reader of this page.
Your response should be ONLY an array of 3 questions, formatted as a JSON array of strings.
Do not include anything else, not even a JSON wrapper object.`;
    }

    const systemPrompt = {
      role: "system",
      content: systemPromptContent,
    };

    let contentPromptText = `Here is the web page content:
Title: ${pageContent.title}
${pageContent.content.substring(0, 3000)}`;

    if (language === "vi") {
      contentPromptText += `\n\nHãy tạo 3 câu hỏi bằng TIẾNG VIỆT về nội dung này.`;
    } else {
      contentPromptText += `\n\nGenerate 3 questions in ENGLISH about this content.`;
    }

    const contentPrompt = {
      role: "user",
      content: contentPromptText,
    };

    const temperature = language === "vi" ? 0.3 : 0.7;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [systemPrompt, contentPrompt],
        temperature: temperature,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Unknown API error");
    }

    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content.trim();
      let questions = [];

      try {
        questions = JSON.parse(content);
      } catch (parseError) {
        console.log(
          "Failed to parse JSON, trying to extract questions directly"
        );

        const questionMatches = content.match(/"([^"]+)"/g);
        if (questionMatches && questionMatches.length > 0) {
          questions = questionMatches.map((q) => q.replace(/"/g, ""));
        } else {
          const lines = content
            .split("\n")
            .filter((line) => line.trim().length > 0);
          if (lines.length > 0) {
            questions = lines.slice(0, 3);
          }
        }
      }

      if (questions.length > 0) {
        return {
          success: true,
          questions: questions.slice(0, 3),
        };
      } else {
        return { success: false, error: "Failed to extract questions" };
      }
    } else {
      throw new Error("No response from API");
    }
  } catch (error) {
    console.error("CocBot: Error generating questions", error);
    return { success: false, error: error.message };
  }
}
