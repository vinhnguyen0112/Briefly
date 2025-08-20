const { OpenAI } = require("openai");
const { qdrantFetch } = require("../clients/qdrantClient");
const { v4: uuidv4 } = require("uuid");
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
 * Generate OpenAI embeddings
 */
async function embedTexts(texts) {
  if (!texts || texts.length === 0) return [];
  try {
    const start = Date.now();
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    const end = Date.now();
    console.log("Embed text took: ", end - start, " ms");
    return resp.data.map((d) => d.embedding);
  } catch (error) {
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
  batchSize = 10, // configurable batch size
}) {
  const tenantId = makeTenantId(userId, pageId);

  const baseText = (content || "").trim();
  const pdfText = (pdfContent || "").trim();
  const fullText = [baseText, pdfText].filter(Boolean).join("\n\n");

  const chunks = chunkText(fullText);
  console.log("Number of chunks generated:", chunks.length);
  if (chunks.length === 0) {
    console.log("No chunks to upsert, exiting.");
    return 0;
  }

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
    console.error(
      `Failed to delete existing chunks for tenant ${tenantId}:`,
      error
    );
  }

  // Embed all chunks in one go (or you could also batch this if your embedder has limits)
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

  // Batch insert into Qdrant
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    try {
      await qdrantFetch(`/collections/${COLLECTION_NAME}/points`, {
        method: "PUT",
        body: JSON.stringify({ points: batch }),
      });
      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1} with ${
          batch.length
        } chunks.`
      );
    } catch (err) {
      console.error(
        `Failed to insert batch ${Math.floor(i / batchSize) + 1}:`,
        err
      );
      // Optionally rethrow if you want to stop on first failure
      // throw err;
    }
  }

  console.log(`Inserted total ${chunks.length} chunks into collection.`);
  return chunks.length;
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
async function ensurePageIngested({
  userId,
  pageId,
  pageUrl,
  title,
  content,
  pdfContent,
  language,
}) {
  const existing = await countPageChunks({ userId, pageId });
  if (existing > 0) return existing;
  return upsertPage({
    userId,
    pageId,
    pageUrl,
    title,
    content,
    pdfContent,
    language,
  });
}

/**
 * Query for relevant page chunks for a tenant
 */
async function queryPage({ userId, pageId, query, topK = 6 }) {
  const tenantId = makeTenantId(userId, pageId);
  const [embedding] = await embedTexts([query]);

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

  const docs = (result.result || []).map((r, idx) => {
    const mapped = {
      text: r.payload?.content || "",
      meta: r.payload || {},
      distance: r.score || null,
    };
    console.log(`Mapped document ${idx + 1}:`, mapped);
    return mapped;
  });

  console.log("Number of documents returned:", docs.length);
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
