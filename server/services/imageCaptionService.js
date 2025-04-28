// File: Capstone2025_ISAL/server/services/imageCaptionService.js

const OpenAI = require('openai');
let pLimit = require('p-limit');
pLimit = pLimit.default || pLimit;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('Using OpenAI API Key:', process.env.OPENAI_API_KEY);

const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

exports.generateCaptions = async (sources) => {
  const tasks = sources.map((src, idx) =>
    limit(async () => {
      try {
        // 1) Build prompt + single image URL
        const userContent = [
          { type: 'text',
            text: 'Generate a concise caption in English for this image (no surrounding quotes).' },
          { type: 'image_url', image_url: { url: src, detail: 'auto' } }
        ];

        // 2) Call OpenAI chat completion
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system',
              content: 'You are an assistant generating single-line captions without extra quotes.' },
            { role: 'user', content: userContent }
          ]
        });

        console.log(`→ [${idx}] Response OK`);

        // 3) Extract and clean the raw caption
        let raw = response.choices[0].message.content.trim();

        // If API returned multiple lines, just take the first
        raw = raw.split(/\r?\n/)[0];

        // Remove any surrounding single or double quotes
        const clean = raw
          .replace(/^['"]+/, '')
          .replace(/['"]+$/, '')
          .trim();

        // 4) Return caption + usage
        return {
          caption: clean,
          usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
      } catch (err) {
        console.error(`→ [${idx}] Error captioning image:`, err.message);
        return {
          caption: null,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
      }
    })
  );

  // Run all tasks in parallel (with limit)
  const results = await Promise.all(tasks);

  // Separate captions and sum usages
  const captions = results.map(r => r.caption);
  const usage = results.reduce((acc, r) => ({
    prompt_tokens: acc.prompt_tokens + r.usage.prompt_tokens,
    completion_tokens: acc.completion_tokens + r.usage.completion_tokens,
    total_tokens: acc.total_tokens + r.usage.total_tokens
  }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });

  return { captions, usage };
};
