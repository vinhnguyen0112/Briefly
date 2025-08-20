const { OpenAI } = require("openai");
const { v4: uuidv4 } = require("uuid");
const { qdrantFetch } = require("../clients/qdrantClient");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COLLECTION_NAME = "capstone2025_response";

/**
 * Generate embedding for text
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function embedQuery(text) {
  if (!text) return null;
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [text],
  });
  return resp.data[0].embedding;
}

/**
 * Derive tenant_id from user_id + page_id
 * @param {string|number} userId
 * @param {string|number} pageId
 */
function makeTenantId(userId, pageId) {
  return `${userId}:${pageId}`;
}

/**
 * Store a response cache (multi-tenant).
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string|number} params.pageId
 * @param {string} params.query
 * @param {string} params.response
 * @param {Object} params.metadata
 * @returns {Promise<string>} The cache entry ID
 */
async function storeResponseCache({
  userId,
  pageId,
  query,
  response,
  metadata = {},
}) {
  const embedding = await embedQuery(query);
  const id = uuidv4();
  const tenantId = makeTenantId(userId, pageId);

  const payload = {
    ...metadata,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
    query,
    response,
  };

  try {
    await qdrantFetch(`/collections/${COLLECTION_NAME}/points`, {
      method: "PUT",
      body: JSON.stringify({
        points: [
          {
            id,
            vector: { default: embedding },
            payload,
          },
        ],
      }),
    });
  } catch (err) {
    console.error(`Failed to store response for tenant ${tenantId}:`, err);
    throw err;
  }
  return id;
}

/**
 * Search for a similar cached response (multi-tenant).
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string|number} params.pageId
 * @param {string} params.query
 * @param {number} [params.topK]
 * @param {number} [params.similarityThreshold]
 * @returns {Promise<{response: string, score: number, metadata: Object}|null>}
 */
async function searchSimilarResponseCache({
  userId,
  pageId,
  query,
  topK = 3,
  similarityThreshold = 0.8,
}) {
  const embedding = await embedQuery(query);
  const tenantId = makeTenantId(userId, pageId);

  const filter = {
    must: [{ key: "tenant_id", match: { value: tenantId } }],
  };

  try {
    const result = await qdrantFetch(
      `/collections/${COLLECTION_NAME}/points/search`,
      {
        method: "POST",
        body: JSON.stringify({
          vector: {
            name: "default",
            vector: embedding,
          },
          filter,
          limit: topK,
          with_payload: true,
          with_vector: false,
          score_threshold: similarityThreshold,
        }),
      }
    );

    if (result?.result?.length > 0) {
      console.log(`Suitable records for tenant ${tenantId}:`);
      result.result.forEach((r, idx) => {
        console.log(
          `  [${idx + 1}] ID=${r.id} | Score=${r.score.toFixed(4)} | Query="${
            r.payload?.query || "N/A"
          }"`
        );
      });

      const best = result.result[0];
      return {
        response: best.payload.response,
        score: best.score,
        metadata: best.payload,
      };
    } else {
      console.log(`No suitable cached response found for tenant ${tenantId}`);
    }
    return null;
  } catch (err) {
    console.error(`Error searching cache for tenant ${tenantId}:`, err);
    throw err;
  }
}

module.exports = {
  storeResponseCache,
  searchSimilarResponseCache,
};
