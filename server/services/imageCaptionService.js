const OpenAI = require("openai");
let pLimit = require("p-limit");
pLimit = pLimit.default || pLimit;
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CONCURRENCY = 5;

/**
 * Generates captions for an array of image sources using OpenAI.
 * @param {String[]} sources Array of image sources (can be URLs or base64 strings).
 * @param {String} context Contextual article/content for captioning.
 * @returns {Promise<{ captions: String[], usage: Object }>}
 * @throws on OpenAI or input errors.
 */
const generateCaptions = async (sources, context) => {
  const limit = pLimit(CONCURRENCY);

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

  try {
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

    return { captions, usage };
  } catch (err) {
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to generate captions using OpenAI",
      401
    );
  }
};

module.exports = { generateCaptions };
