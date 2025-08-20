const { OpenAI } = require("openai");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");
let pLimit = require("p-limit");
const commonHelper = require("../helpers/commonHelper");
const { redisHelper } = require("../helpers/redisHelper");
const PageSummary = require("../models/pageSummary");
const AnonSession = require("../models/anonSession");
const Page = require("../models/page");
const ragService = require("../services/ragService");
const responseCachingService = require("../services/responseCachingService");

const limit = pLimit(5); // 5 concurrency
const openaiLimit = pLimit(3); // 3 concurrent OpenAI requests
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 1 day in ms
const FRESHNESS_BUFFER_MS = 5 * 60 * 1000; // 5 mins offset for clock drift
const FRESHNESS_THRESHOLD = ONE_DAY_MS - FRESHNESS_BUFFER_MS;
const MAX_ANON_QUERIES = 3;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to get normalized page url & page ID (hash value)
 * @param {String} pageUrl
 */
function getNormalizedPageMeta(pageUrl) {
  const normalizedPageUrl = commonHelper.processUrl(pageUrl);
  if (!normalizedPageUrl) return null;
  const pageId = commonHelper.generateHash(normalizedPageUrl);
  return { pageId, normalizedPageUrl };
}

/**
 * Generate response for user query using OpenAI model
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
const handleUserQuery = async (req, res, next) => {
  try {
    const { messages, metadata } = req.body;

    const pageMeta = getNormalizedPageMeta(metadata.page_url);
    if (!pageMeta) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid page URL");
    }

    // Check anon limit before doing any expensive work
    if (
      req.sessionType === "anon" &&
      req.session.anon_query_count >= MAX_ANON_QUERIES
    ) {
      throw new AppError(
        ERROR_CODES.ANON_QUERY_LIMIT_REACHED,
        "Anonymous query limit reached"
      );
    }

    const isAuth = req.sessionType === "auth" && req.session?.id;

    let cachedResponse = null;
    if (isAuth) {
      // Try to find a cached response first
      cachedResponse = await responseCachingService.searchSimilarResponseCache({
        userId: req.session.user_id,
        pageId: pageMeta.pageId,
        query: messages[messages.length - 1]?.content || "",
        topK: 3,
      });
    }

    if (cachedResponse?.response) {
      return res.json({
        success: true,
        data: {
          message: cachedResponse.response,
          usage: null,
          model: "cached",
          cache_score: cachedResponse.score,
        },
      });
    }

    let assistantMessage;
    // Get stored summary (fast path for summarize event)
    if (metadata.event === "summarize") {
      assistantMessage = await getStoredPageSummary(
        pageMeta.pageId,
        metadata.language
      );
    }

    if (!assistantMessage) {
      let useRag = Boolean(metadata.use_rag);

      // RAG handling
      if (!useRag && isAuth) {
        const pageRow = await Page.getById(pageMeta.pageId);
        const contentLen =
          (pageRow?.page_content?.length || 0) +
          (pageRow?.pdf_content?.length || 0);
        useRag = contentLen > 4000;
      }

      if (useRag && isAuth) {
        const pageRow = await Page.getById(pageMeta.pageId);
        if (pageRow) {
          await ragService.ensurePageIngested({
            userId: req.session.user_id,
            pageId: pageMeta.pageId,
            pageUrl: pageRow.page_url,
            title: pageRow.title,
            content: pageRow.page_content,
            pdfContent: pageRow.pdf_content,
            language: req.headers["accept-language"] || "",
          });

          // Find relevant contexts
          const { docs: contexts } = await ragService.queryPage({
            userId: req.session.user_id,
            pageId: pageMeta.pageId,
            query: messages[messages.length - 1]?.content || "",
            topK: 6,
          });

          const contextBlock = contexts
            .map((c) => `[#${c.meta.chunk_index}] ${c.text}`)
            .join("\n\n");

          const ragMessages = [
            messages[0],
            {
              role: "system",
              content: `Context snippets from page ${pageRow.title || ""} (${
                pageRow.page_url
              }):\n\n${contextBlock}`,
            },
            messages[messages.length - 1],
          ];

          assistantMessage = await generateAssistantResponse(
            ragMessages,
            metadata.max_tokens
          );
        }
      }

      if (!assistantMessage) {
        assistantMessage = await generateAssistantResponse(
          messages,
          metadata.max_tokens
        );
      }
    }

    // Response caching
    if (isAuth) {
      responseCachingService
        .storeResponseCache({
          userId: req.session.user_id,
          pageId: pageMeta.pageId,
          query: messages[messages.length - 1]?.content || "",
          response: assistantMessage.message,
          metadata: {
            normalized_page_url: pageMeta.normalizedPageUrl,
            language: metadata.language,
          },
        })
        .catch((err) => {
          console.warn("Cache store error:", err);
        });
    }

    let newCount = null;
    // Increase anon query count
    if (req.sessionType === "anon") {
      const affectedRows = await AnonSession.increaseAnonQueryCount(
        req.session.id
      );

      if (affectedRows > 0) {
        newCount = req.session.anon_query_count + 1;
        await redisHelper.updateRecord("anon", req.session.id, {
          anon_query_count: newCount,
        });
      }
    }

    return res.json({
      success: true,
      data: {
        message: assistantMessage.message,
        usage: assistantMessage.usage,
        model: assistantMessage.model,
      },
      anon_query_count: newCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates assistant response using OpenAI
 * @param {Array} messages
 * @param {number} max_tokens
 * @returns {Promise<{message: string, usage: Object, model: string}>}
 */
async function generateAssistantResponse(messages, max_tokens) {
  const completion = await openaiLimit(() =>
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens,
      messages,
    })
  );

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
    message: completion.choices[0].message.content,
    usage: completion.usage,
    model: completion.model,
  };
}

/**
 * Try to get cached or stored page summary.
 * Returns null if not found or expired.
 * @param {String} pageId
 * @param {String} language
 * @returns {Promise<{message: string, usage: null, model: string} | null>}
 */
async function getStoredPageSummary(pageId, language) {
  // Try to get from Redis
  const cached = await redisHelper.getPageSummary(pageId, language);
  if (cached) {
    console.log("Page summary cache hit");
    return {
      message: cached,
      usage: null,
      model: "cached",
    };
  }

  console.log("Page summary cache missed");

  // Try to get from database
  const stored = await PageSummary.getByPageIdAndLanguage(pageId, language);
  if (stored?.summary) {
    const createdAt = new Date(stored.created_at);
    const now = Date.now();

    // If not expired
    if (now - createdAt.getTime() <= FRESHNESS_THRESHOLD) {
      // Update cache and return
      await redisHelper.setPageSummary({
        pageId: stored.page_id,
        language: stored.language,
        summary: stored.summary,
      });

      return {
        message: stored.summary,
        usage: null,
        model: "cached",
      };
    }

    // Otherwise, delete expired summary
    await PageSummary.deleteById(stored.id);
  }

  return null;
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

    // Build the content prompt
    let contentPromptText = `
      Here is the web page content:
      Title: ${pageContent.title}
      URL: ${pageContent.url || "Unknown"}

      ${pageContent.content.substring(0, 3000)}
      `;

    // Handle pdf content
    if (pageContent.pdfContent) {
      contentPromptText += `
        --- Embedded PDF detected on this page ---

        Here's an excerpt of the PDF content:
        ${pageContent.pdfContent}
        `;
    }

    if (language === "vi") {
      contentPromptText += `\n\nHãy tạo 3 câu hỏi bằng TIẾNG VIỆT về nội dung này.`;
    } else {
      contentPromptText += `\n\nGenerate 3 questions in ENGLISH about this content.`;
    }

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

    const completion = await openaiLimit(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [systemPrompt, contentPrompt],
        temperature,
        max_tokens: 500,
      })
    );

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
      const result = {
        success: true,
        data: {
          questions: questions.slice(0, 3),
          usage: completion.usage || null,
        },
      };

      return res.json(result);
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

          const response = await openaiLimit(() =>
            openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages,
              temperature: 0.5,
            })
          );

          const raw = response.choices?.[0]?.message?.content?.trim() || "";
          const clean = raw.replace(/^['"]+|['"]+$/g, "").split(/\r?\n/)[0];

          const result = {
            caption: clean,
            usage: response.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          };

          console.log("Generated questions response: ", result);

          return res.json(result);
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
    next(err);
  }
};

module.exports = {
  handleUserQuery,
  generateSuggestedQuestions,
  captionize,
};
