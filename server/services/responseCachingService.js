const { getClient } = require("../clients/qdrantClient");
const { OpenAI } = require("openai");
const { v4: uuidv4 } = require("uuid");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COLLECTION_NAME = "briefly_response_cache";
const VECTOR_SIZE = 1536;

/**
 * Ensure the Qdrant collection exists
 */
async function initializeCollection() {
  const client = await getClient();
  try {
    await client.getCollection(COLLECTION_NAME);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log("Collection not found, creating...");
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
    }
    throw err;
  }
}

async function embedQuery(text) {
  if (!text) return null;
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
 * @param {Object} params.metadata
 * @returns {Promise<string>} The cache entry ID
 */
async function storeResponseCache({ userId, query, response, metadata = {} }) {
  const client = await getClient();
  const embedding = await embedQuery(query);
  const id = uuidv4();
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
          id,
          vector: embedding,
          payload,
        },
      ],
    });
  } catch (err) {
    console.error(`Failed to store response for user ${userId}:`, err);
    throw err;
  }
  return id;
}

/**
 * Search for a similar cached response for a user query (multitenant).
 * @param {Object} params
 * @param {string|number} params.userId
 * @param {string} params.query
 * @param {Object} params.metadata
 * @param {number} [params.topK=3]
 * @param {number} [params.similarityThreshold=0.90] // cosine similarity (1.0 = identical)
 * @returns {Promise<{response: string, score: number, metadata: Object}|null>}
 */
async function searchSimilarResponseCache({
  userId,
  query,
  metadata = {},
  topK = 3,
  similarityThreshold = 0.7,
}) {
  const client = await getClient();
  const embedding = await embedQuery(query);

  const must = [{ key: "user_id", match: { value: userId } }];
  if (metadata.page_id)
    must.push({
      key: "page_id",
      match: { value: metadata.page_id },
    });
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
      console.log("Suitable records:");
      result.forEach((r, idx) => {
        console.log(
          `  [${idx + 1}] ID=${r.id} | Score=${r.score.toFixed(4)} | Query="${
            r.payload?.query || "N/A"
          }"`
        );
      });

      const best = result[0];

      return {
        response: best.payload.response,
        score: best.score,
        metadata: best.payload,
      };
    } else {
      console.log("No suitable cached response found");
    }
    return null;
  } catch (err) {
    console.error(`Error searching cache for user ${userId}:`, err);
    throw err;
  }
}

module.exports = {
  initializeCollection,
  storeResponseCache,
  searchSimilarResponseCache,
};
