const { getClient } = require("../clients/chromaClient");
const { OpenAI } = require("openai");
const commonHelper = require("../helpers/commonHelper");
const { ChromaClient } = require("chromadb");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getUserCollectionName(userId) {
  return `briefly_user_${userId}`;
}

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
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  } catch (error) {
    console.error("OpenAI embedding error:", error);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

async function getOrCreateUserCollection(userId) {
  const client = await getClient();
  const name = getUserCollectionName(userId);
  try {
    return await client.getOrCreateCollection({ name });
  } catch (error) {
    console.error(`Failed to get/create collection ${name}:`, error);
    throw new Error(`ChromaDB collection error: ${error.message}`);
  }
}

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

  const collection = await getOrCreateUserCollection(userId);
  console.log("Collection retrieved:", collection.name);

  const baseText = (content || "").trim();
  const pdfText = (pdfContent || "").trim();
  const fullText = [baseText, pdfText].filter(Boolean).join("\n\n");

  const chunks = chunkText(fullText);
  console.log("Number of chunks generated:", chunks.length);
  if (chunks.length === 0) {
    console.log("No chunks to upsert, exiting.");
    return 0;
  }

  try {
    await collection.delete({ where: { page_id: pageId } });
  } catch (error) {
    console.error(
      `Failed to delete existing chunks for page ${pageId}:`,
      error
    );
  }

  const embeddings = await embedTexts(chunks);
  const ids = chunks.map((_, i) => `${pageId}:${i}`);

  const metadatas = chunks.map((_, i) => ({
    page_id: pageId,
    page_url: pageUrl,
    title: title || "",
    chunk_index: i,
    lang: language || "",
  }));
  console.log("Sample metadata:", metadatas[0]);

  await collection.add({ ids, documents: chunks, metadatas, embeddings });
  console.log(`Inserted ${chunks.length} chunks into collection.`);

  return chunks.length;
}

async function countPageChunks({ userId, pageId }) {
  const collection = await getOrCreateUserCollection(userId);
  const res = await collection.count({ where: { page_id: pageId } });
  return typeof res === "number" ? res : 0;
}

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

async function queryPage({ userId, pageId, query, topK = 6 }) {
  const collection = await getOrCreateUserCollection(userId);
  console.log("Collection retrieved:", collection.name);

  const [embedding] = await embedTexts([query]);
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where: { page_id: pageId },
    include: ["documents", "metadatas", "distances"],
  });

  const docs = (results.documents?.[0] || []).map((doc, idx) => {
    const mapped = {
      text: doc,
      meta: results.metadatas?.[0]?.[idx] || {},
      distance: results.distances?.[0]?.[idx] || null,
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
  getOrCreateUserCollection,
  upsertPage,
  ensurePageIngested,
  queryPage,
};
