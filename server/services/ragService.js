const { OpenAI } = require("openai");
const { qdrantFetch } = require("../clients/qdrantClient");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COLLECTION_NAME = "capstone2025_page";

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
 * Upsert all page chunks for a user and page into the shared collection.
 */
async function upsertPage({
  userId,
  pageId,
  pageUrl,
  title,
  content,
  pdfContent,
  language,
}) {
  console.log("upsertPage called with:", {
    userId,
    pageId,
    pageUrl,
    title,
    language,
  });

  const baseText = (content || "").trim();
  const pdfText = (pdfContent || "").trim();
  const fullText = [baseText, pdfText].filter(Boolean).join("\n\n");

  const chunks = chunkText(fullText);
  console.log("Number of chunks generated:", chunks.length);
  if (chunks.length === 0) {
    console.log("No chunks to upsert, exiting.");
    return 0;
  }

  // Delete existing chunks for this user and page
  try {
    await qdrantFetch(`/collections/${COLLECTION_NAME}/points/delete`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          must: [
            { key: "user_id", match: { value: userId } },
            { key: "page_id", match: { value: pageId } },
          ],
        },
      }),
    });
  } catch (error) {
    console.error(
      `Failed to delete existing chunks for user ${userId}, page ${pageId}:`,
      error
    );
  }

  const embeddings = await embedTexts(chunks);
  const ids = chunks.map((_, i) => `${userId}:${pageId}:${i}`);

  const points = chunks.map((chunk, i) => ({
    id: ids[i],
    vector: embeddings[i],
    payload: {
      user_id: userId,
      page_id: pageId,
      page_url: pageUrl,
      title: title || "",
      chunk_index: i,
      lang: language || "",
      content: chunk,
    },
  }));

  await qdrantFetch(`/collections/${COLLECTION_NAME}/points`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });
  console.log(`Inserted ${chunks.length} chunks into collection.`);

  return chunks.length;
}

/**
 * Count the number of chunks for a user and page.
 */
async function countPageChunks({ userId, pageId }) {
  const result = await qdrantFetch(
    `/collections/${COLLECTION_NAME}/points/count?exact=true`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          must: [
            { key: "user_id", match: { value: userId } },
            { key: "page_id", match: { value: pageId } },
          ],
        },
      }),
    }
  );
  return result?.result?.count || 0;
}

/**
 * Ensure a page is ingested for a user.
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
 * Query for relevant page chunks for a user and page.
 */
async function queryPage({ userId, pageId, query, topK = 6 }) {
  const [embedding] = await embedTexts([query]);
  const result = await qdrantFetch(
    `/collections/${COLLECTION_NAME}/points/search`,
    {
      method: "POST",
      body: JSON.stringify({
        vector: embedding,
        filter: {
          must: [
            { key: "user_id", match: { value: userId } },
            { key: "page_id", match: { value: pageId } },
          ],
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
