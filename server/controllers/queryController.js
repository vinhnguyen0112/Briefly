const { OpenAI } = require("openai");
const AppError = require("../models/appError");
const Chat = require("../models/chat");
const Message = require("../models/message");
const Page = require("../models/page");
const { ERROR_CODES } = require("../errors");
let pLimit = require("p-limit");
const { v4: uuidv4 } = require("uuid");
const commonHelper = require("../helpers/commonHelper");
const { redisHelper } = require("../helpers/redisHelper");

const limit = pLimit(5); // 5 concurrency

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate response for user query using OpenAI model.
 * Optionally, store chats, user messages and assistant responses
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
// TODO: If found summary, should still check if need to create a new chat or not or else chatID will never be initialized (null)
const handleUserQuery = async (req, res, next) => {
  try {
    const { messages, max_tokens, chat_meta } = req.body;

    console.log("Chat meta: ", chat_meta);

    // Look for cached summary first
    if (chat_meta.event === "summarize") {
      const normalizedPageUrl = commonHelper.processUrl(chat_meta.page_url);
      if (!normalizedPageUrl)
        throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
      const pageId = commonHelper.generateHash(normalizedPageUrl);

      // Check for existing summary
      const result = await getExistingPageSummary(pageId);

      if (result.found) {
        return res.json({
          success: true,
          data: {
            message: result.summary,
            usage: null,
            model: result.source,
            chat_id: null,
            source: result.source,
          },
        });
      }
    }

    // Generate assistant response
    const assistantMessage = await generateAssistantResponse(
      messages,
      max_tokens
    );

    // Prepare parallel tasks
    let chatId = null;
    const tasks = [];

    // Only authenticated users can store chats/messages
    if (req.session && req.sessionType === "auth" && req.session.user_id) {
      const chatTask = storeChatAndMessages(
        chat_meta,
        assistantMessage,
        req
      ).then((id) => {
        chatId = id;
      });
      tasks.push(chatTask);
    }

    // Store page summary
    if (chat_meta.event === "summarize") {
      tasks.push(storePageSummary(chat_meta, assistantMessage.content));
    }

    // Run both tasks in parallel
    await Promise.all(tasks);

    // Respond
    res.json({
      success: true,
      data: {
        message: assistantMessage.content,
        usage: assistantMessage.usage,
        model: assistantMessage.model,
        chat_id: chatId,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates assistant response using OpenAI
 * @param {Array} messages
 * @param {number} max_tokens
 * @returns {Promise<{content: string, usage: object, model: string}>}
 */
async function generateAssistantResponse(messages, max_tokens) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens,
    messages,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message
  ) {
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Invalid OpenAI response"
    );
  }

  return {
    content: completion.choices[0].message.content,
    usage: completion.usage,
    model: completion.model,
  };
}

/**
 * Handles chat creation and message storage
 * @param {Object} chat_meta
 * @param {Object} assistantMessage
 * @param {Object} req
 * @returns {Promise<string>} chatId
 */
async function storeChatAndMessages(chat_meta, assistantMessage, req) {
  let chatId = chat_meta?.chat_id;

  // Create chat if requested
  if (chat_meta?.should_create_chat) {
    chatId = chatId || uuidv4();

    // Normalize page_url and hash to get page ID
    const normalizedPageUrl = commonHelper.processUrl(chat_meta.page_url);
    if (!normalizedPageUrl) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }
    const pageId = commonHelper.generateHash(normalizedPageUrl);

    await Chat.create({
      id: chatId,
      user_id: req.session.user_id,
      page_url: normalizedPageUrl,
      page_id: pageId,
      title: chat_meta.title,
    });
  }

  // Insert user message
  if (chatId && chat_meta?.user_query) {
    await Message.create({
      chat_id: chatId,
      role: "user",
      content: chat_meta.user_query,
    });
  }

  // Insert assistant message
  if (chatId) {
    await Message.create({
      chat_id: chatId,
      role: "assistant",
      content: assistantMessage.content,
      model: assistantMessage.model,
    });
  }

  return chatId;
}

/**
 * Stores page summary in the database
 * @param {Object} chat_meta
 * @param {Object} assistantMessage
 */
async function storePageSummary(chat_meta, summary) {
  const normalizedPageUrl = commonHelper.processUrl(chat_meta.page_url);
  if (!normalizedPageUrl) return;
  const pageId = commonHelper.generateHash(normalizedPageUrl);

  await Page.create({
    id: pageId,
    page_url: normalizedPageUrl,
    title: chat_meta.title,
    summary,
  });

  await redisHelper.setPageSummary(pageId, summary);
}

/**
 * Checks for an existing page summary in Redis or MySQL.
 * If found, returns the summary and updates Redis cache if needed.
 * @param {String} pageId
 * @returns {Promise<{found: boolean, summary: string, source: string}>}
 */
async function getExistingPageSummary(pageId) {
  // Try Redis cache first
  let summary = await redisHelper.getPageSummary(pageId);
  if (summary) {
    return { found: true, summary, source: "redis" };
  }

  // Fallback to MySQL
  const page = await Page.getById(pageId);
  if (page && page.summary) {
    // Update Redis cache for future requests
    await redisHelper.setPageSummary(pageId, page.summary);
    return { found: true, summary: page.summary, source: "mysql" };
  }

  return { found: false, summary: null, source: null };
}

/**
 * Generates 3 suggested questions based on provided content
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const generateSuggestedQuestions = async (req, res, next) => {
  try {
    const { pageContent, language = "en" } = req.body;

    if (!pageContent || !pageContent.content) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing page content");
    }

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemPrompt, contentPrompt],
      temperature,
      max_tokens: 500,
    });

    if (
      !completion ||
      !completion.choices ||
      !completion.choices[0] ||
      !completion.choices[0].message
    ) {
      throw new AppError(
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        "Invalid OpenAI response"
      );
    }

    const content = completion.choices[0].message.content.trim();
    let questions = [];

    try {
      questions = JSON.parse(content);
    } catch (parseError) {
      // Try to extract questions from quoted strings
      const questionMatches = content.match(/"([^"]+)"/g);
      if (questionMatches && questionMatches.length > 0) {
        questions = questionMatches.map((q) => q.replace(/"/g, ""));
      } else {
        // Fallback: split by lines
        const lines = content
          .split("\n")
          .filter((line) => line.trim().length > 0);
        if (lines.length > 0) {
          questions = lines.slice(0, 3);
        }
      }
    }

    if (questions.length > 0) {
      return res.json({
        success: true,
        data: {
          questions: questions.slice(0, 3),
        },
      });
    } else {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        "Failed to extract suggested questions"
      );
    }
  } catch (err) {
    console.error("Error generating questions:", err);
    next(err);
  }
};

/**
 * Generates captions for an array of image sources using OpenAI.
 * @param {String[]} sources Array of image sources (can be URLs or base64 strings).
 * @param {String} context Contextual article/content for captioning.
 * @returns {Promise<{ captions: String[], usage: Object }>}
 * @throws on OpenAI or input errors.
 */
const captionize = async (req, res, next) => {
  try {
    const { sources, context } = req.body;

    const tasks = sources.map((src, idx) =>
      limit(async () => {
        try {
          const messages = [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates short detail captions for images, using the article provided to infer names, events, or context.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: context.slice(0, 100000),
                },
                {
                  type: "text",
                  text: "Based on the article above, generate a short detail caption (no quotation marks) for the image below. Use the article to identify people, events, or context relevant to the image.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: src,
                    detail: "low",
                  },
                },
              ],
            },
          ];

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.5,
          });

          const raw = response.choices?.[0]?.message?.content?.trim() || "";
          const clean = raw.replace(/^['"]+|['"]+$/g, "").split(/\r?\n/)[0];

          return {
            caption: clean,
            usage: response.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          };
        } catch (err) {
          console.error(`Caption error for image ${idx}:`, err);
          return {
            caption: null,
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          };
        }
      })
    );

    const results = await Promise.all(tasks);

    const captions = results.map((r) => r.caption);
    const usage = results.reduce(
      (acc, r) => ({
        prompt_tokens: acc.prompt_tokens + r.usage.prompt_tokens,
        completion_tokens: acc.completion_tokens + r.usage.completion_tokens,
        total_tokens: acc.total_tokens + r.usage.total_tokens,
      }),
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    );

    res.json({ success: true, data: { captions, usage } });
  } catch (err) {
    next(
      new AppError(
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        "Failed to generate captions using OpenAI",
        401
      )
    );
  }
};

module.exports = {
  handleUserQuery,
  generateSuggestedQuestions,
  captionize,
};
