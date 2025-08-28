const { redisHelper } = require("../helpers/redisHelper");
const crypto = require("crypto");

/**
 * Normalize and hash a question string.
 * @param {string} question
 * @returns {string} hash
 */
function normalizeAndHash(question) {
  if (!question) return "";
  const normalized = question.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Compose a Redis key for user/page/question.
 * @param {string|number} userId
 * @param {string|number} pageId
 * @param {string} question
 */
function makeCacheKey(userId, pageId, question) {
  const qHash = normalizeAndHash(question);
  return `${process.env.REDIS_PREFIX}:response:${userId}:${pageId}:${qHash}`;
}

/**
 * Store a response cache in Redis.
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string|number} params.pageId
 * @param {string} params.query
 * @param {string} params.response
 * @param {Object} params.metadata
 * @returns {Promise<void>}
 */
async function storeResponseCache({
  userId,
  pageId,
  query,
  response,
  metadata = {},
}) {
  const key = makeCacheKey(userId, pageId, query);
  const value = JSON.stringify({
    response,
    metadata,
    created_at: new Date().toISOString(),
  });
  // Set TTL, e.g., 1 day (customize as needed)
  await redisHelper.client.set(key, value, { EX: 60 * 60 * 24 });
}

/**
 * Search for an exact cached response in Redis.
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string|number} params.pageId
 * @param {string} params.query
 * @returns {Promise<{response: string, metadata: Object}|null>}
 */
async function searchSimilarResponseCache({ userId, pageId, query }) {
  const key = makeCacheKey(userId, pageId, query);
  const value = await redisHelper.client.get(key);
  if (value) {
    const parsed = JSON.parse(value);
    return {
      response: parsed.response,
      metadata: parsed.metadata,
    };
  }
  return null;
}

module.exports = {
  storeResponseCache,
  searchSimilarResponseCache,
};
