const { OpenAI } = require("openai");
const { qdrantFetch } = require("../clients/qdrantClient");
const { v4: uuidv4 } = require("uuid");
const metricsService = require("./metricsService");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COLLECTION_NAME = "capstone2025_page";

/**
 * Chunk long text into overlapping parts
 */
function chunkText(text, chunkSize = 2000, overlap = 200) {
  const chunks = [];
  if (!text) return chunks;
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end);
    chunks.push(slice);
    if (end === text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

/**
 * Generate OpenAI embeddings (with monitoring)
 */
async function embedTexts(texts) {
  if (!texts || texts.length === 0) return [];
  const startTime = Date.now();
  try {
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    const duration = (Date.now() - startTime) / 1000;

    // record metrics
    metricsService.recordOpenAIRequest(
      "text-embedding-3-small",
      "embeddings",
      "success",
      duration
    );
    metricsService.recordRagOperation("embeddings", "success", duration);

    return resp.data.map((d) => d.embedding);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordOpenAIRequest(
      "text-embedding-3-small",
      "embeddings",
      "error",
      duration
    );
    metricsService.recordRagOperation("embeddings", "error", duration);
    console.error("OpenAI embedding error:", error);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

/**
 * Build tenant_id from user_id and page_id
 */
function makeTenantId(userId, pageId) {
  return `${userId}:${pageId}`;
}

/**
 * Upsert all page chunks for a tenant (user+page) into the shared collection.
 */
async function upsertPage({
  userId,
  pageId,
  pageUrl,
  title,
  content,
  pdfContent,
  language,
  batchSize = 10,
}) {
  const tenantId = makeTenantId(userId, pageId);
  const baseText = (content || "").trim();
  const pdfText = (pdfContent || "").trim();
  const fullText = [baseText, pdfText].filter(Boolean).join("\n\n");

  const chunks = chunkText(fullText);
  if (chunks.length === 0) return 0;

  // Delete existing chunks for this tenant
  try {
    await qdrantFetch(`/collections/${COLLECTION_NAME}/points/delete`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          must: [{ key: "tenant_id", match: { value: tenantId } }],
        },
      }),
    });
  } catch (error) {
    console.error(`Failed to delete existing chunks for tenant ${tenantId}:`, error);
  }

  const embeddings = await embedTexts(chunks);

  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      tenant_id: tenantId,
      user_id: userId,
      page_id: pageId,
      page_url: pageUrl,
      title: title || "",
      chunk_index: i,
      lang: language || "",
      content: chunk,
    },
  }));

  const startTime = Date.now();
  let totalInserted = 0;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    try {
      await qdrantFetch(`/collections/${COLLECTION_NAME}/points`, {
        method: "PUT",
        body: JSON.stringify({ points: batch }),
      });
      totalInserted += batch.length;
    } catch (err) {
      console.error(`Failed to insert batch ${Math.floor(i / batchSize) + 1}:`, err);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  metricsService.recordRagOperation("upsertPage", "success", duration);

  return totalInserted;
}

/**
 * Count the number of chunks for a tenant
 */
async function countPageChunks({ userId, pageId }) {
  const tenantId = makeTenantId(userId, pageId);
  const result = await qdrantFetch(
    `/collections/${COLLECTION_NAME}/points/count?exact=true`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          must: [{ key: "tenant_id", match: { value: tenantId } }],
        },
      }),
    }
  );
  return result?.result?.count || 0;
}

/**
 * Ensure a page is ingested for a tenant
 */
async function ensurePageIngested({ userId, pageId, pageUrl, title, content, pdfContent, language }) {
  const existing = await countPageChunks({ userId, pageId });
  if (existing > 0) return existing;
  return upsertPage({ userId, pageId, pageUrl, title, content, pdfContent, language });
}

/**
 * Query for relevant page chunks for a tenant
 */
async function queryPage({ userId, pageId, query, topK = 6 }) {
  const tenantId = makeTenantId(userId, pageId);
  const [embedding] = await embedTexts([query]);

  const startTime = Date.now();
  const result = await qdrantFetch(
    `/collections/${COLLECTION_NAME}/points/search`,
    {
      method: "POST",
      body: JSON.stringify({
        vector: embedding,
        filter: {
          must: [{ key: "tenant_id", match: { value: tenantId } }],
        },
        limit: topK,
        with_payload: true,
        with_vector: false,
      }),
    }
  );
  const duration = (Date.now() - startTime) / 1000;
  metricsService.recordRagOperation("queryPage", "success", duration);

  const docs = (result.result || []).map((r, idx) => ({
    text: r.payload?.content || "",
    meta: r.payload || {},
    distance: r.score || null,
  }));

  return { docs, queryEmbedding: embedding };
}

module.exports = {
  chunkText,
  embedTexts,
  upsertPage,
  ensurePageIngested,
  queryPage,
  countPageChunks,
};
