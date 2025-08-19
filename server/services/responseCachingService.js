const { getClient } = require("../clients/qdrantClient");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use a single collection for all users (multitenancy)
const COLLECTION_NAME = "briefly_response_cache";
const VECTOR_SIZE = 1536; // Adjust if your embedding model changes

async function getOrCreateCacheCollection() {
  const client = await getClient();
  try {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log(
      `[Qdrant] Collection '${COLLECTION_NAME}' created or already exists.`
    );
  } catch (err) {
    // Ignore "already exists" error
    if (!String(err.message).includes("already exists")) {
      console.error(
        `[Qdrant] Error creating collection '${COLLECTION_NAME}':`,
        err
      );
      throw err;
    } else {
      console.log(`[Qdrant] Collection '${COLLECTION_NAME}' already exists.`);
    }
  }
  return client;
}

async function embedQuery(text) {
  if (!text) return null;
  console.log(
    `[Cache] Embedding query: "${text.slice(0, 80)}${
      text.length > 80 ? "..." : ""
    }"`
  );
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [text],
  });
  return resp.data[0].embedding;
}

/**
 * Store a response cache for a user (multitenant).
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string} params.query
 * @param {string} params.response
 * @param {Object} params.metadata (e.g. page_url, language, etc.)
 * @returns {Promise<string>} The cache entry ID
 */
async function storeResponseCache({ userId, query, response, metadata = {} }) {
  const client = await getOrCreateCacheCollection();
  const embedding = await embedQuery(query);
  const cacheId = `${userId}:${
    metadata.page_url || "page"
  }:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    ...metadata,
    user_id: userId,
    created_at: new Date().toISOString(),
    query,
    response,
  };

  try {
    await client.upsert(COLLECTION_NAME, {
      points: [
        {
          id: cacheId,
          vector: embedding,
          payload,
        },
      ],
    });
    console.log(
      `[Cache] Stored response for user ${userId} (cacheId: ${cacheId})`
    );
  } catch (err) {
    console.error(`[Cache] Failed to store response for user ${userId}:`, err);
    throw err;
  }
  return cacheId;
}

/**
 * Search for a similar cached response for a user query (multitenant).
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string} params.query
 * @param {Object} params.metadata (e.g. page_url, language, etc.)
 * @param {number} [params.topK=3]
 * @param {number} [params.similarityThreshold=0.90] // cosine similarity (1.0 = identical)
 * @returns {Promise<{response: string, score: number, metadata: Object}|null>}
 */
async function searchSimilarResponseCache({
  userId,
  query,
  metadata = {},
  topK = 3,
  similarityThreshold = 0.9,
}) {
  const client = await getOrCreateCacheCollection();
  const embedding = await embedQuery(query);

  // Multitenant: always filter by user_id
  const must = [{ key: "user_id", match: { value: userId } }];
  if (metadata.page_url)
    must.push({ key: "page_url", match: { value: metadata.page_url } });
  if (metadata.language)
    must.push({ key: "language", match: { value: metadata.language } });

  const filter = { must };

  try {
    const result = await client.search(COLLECTION_NAME, {
      vector: embedding,
      filter,
      limit: topK,
      with_payload: true,
      with_vector: false,
      score_threshold: similarityThreshold,
    });

    if (result && result.length > 0) {
      const best = result[0];
      console.log(
        `[Cache] Found similar cached response for user ${userId} (score: ${best.score.toFixed(
          3
        )})`
      );
      return {
        response: best.payload.response,
        score: best.score,
        metadata: best.payload,
      };
    } else {
      console.log(
        `[Cache] No similar cached response found for user ${userId}.`
      );
    }
    return null;
  } catch (err) {
    console.error(`[Cache] Error searching cache for user ${userId}:`, err);
    throw err;
  }
}

module.exports = {
  storeResponseCache,
  searchSimilarResponseCache,
};
