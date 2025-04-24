import { state, getApiKey } from "./state.js";
import {
  addMessageToChat,
  addTypingIndicator,
  removeTypingIndicator,
} from "./ui-handler.js";
import { elements } from "./dom-elements.js";

// process a user query
export async function processUserQuery(query) {
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

    console.log("CocBot: Got page content:", state.pageContent ? "Yes" : "No");
    if (state.pageContent) {
      console.log("CocBot: Page title:", state.pageContent.title);
    }

    const messages = await constructPromptWithPageContent(
      query,
      state.pageContent,
      state.history,
      state.currentConfig
    );

    const response = await callOpenAI(apiKey, messages);

    removeTypingIndicator(typingIndicator);

    if (response.success) {
      addMessageToChat(response.message, "assistant");

      state.history.push({ role: "user", content: query });
      state.history.push({ role: "assistant", content: response.message });

      if (state.history.length > 6) {
        state.history = state.history.slice(state.history.length - 6);
      }
    } else {
      addMessageToChat("Oops, got an error: " + response.error, "assistant");
    }
  } catch (error) {
    console.error("CocBot: Query error:", error);
    removeTypingIndicator(typingIndicator);
    addMessageToChat("Something went wrong. Try again?", "assistant");
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
        model: "gpt-3.5-turbo",
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

  const systemPrompt = {
    role: "system",
    content: `You are a helpful assistant that helps users understand web page content.
You have access to the content of the page the user is currently viewing, which is provided below.
Answer the user's questions based on this content. If the answer is not in the content, say so.
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

    const systemPrompt = {
      role: "system",
      content: `You are an AI that generates 3 interesting questions about web page content. 
Generate questions that would be useful to a reader of this page.
Your response should be ONLY an array of 3 questions, formatted as a JSON array of strings.
Do not include anything else, not even a JSON wrapper object.`,
    };

    const contentPrompt = {
      role: "user",
      content: `Here is the web page content:
Title: ${pageContent.title}
${pageContent.content.substring(0, 3000)}`,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [systemPrompt, contentPrompt],
        temperature: 0.7,
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
