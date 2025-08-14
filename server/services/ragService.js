const { getClient } = require("../clients/chromaClient");
const { OpenAI } = require("openai");
const commonHelper = require("../helpers/commonHelper");

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
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

async function getOrCreateUserCollection(userId) {
  const client = await getClient();
  const name = getUserCollectionName(userId);
  try {
    return await client.getOrCreateCollection({ name });
  } catch (e) {
    return await client.createCollection({ name });
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
  const collection = await getOrCreateUserCollection(userId);
  const baseText = (content || "").trim();
  const pdfText = (pdfContent || "").trim();
  const fullText = [baseText, pdfText].filter(Boolean).join("\n\n");
  const chunks = chunkText(fullText);
  if (chunks.length === 0) return 0;

  try {
    await collection.delete({ where: { page_id: pageId } });
  } catch (_) {}

  const embeddings = await embedTexts(chunks);
  const ids = chunks.map((_, i) => `${pageId}:${i}`);
  const metadatas = chunks.map((_, i) => ({
    page_id: pageId,
    page_url: pageUrl,
    title: title || "",
    chunk_index: i,
    lang: language || "",
  }));

  await collection.add({ ids, documents: chunks, metadatas, embeddings });
  return chunks.length;
}

async function countPageChunks({ userId, pageId }) {
  const collection = await getOrCreateUserCollection(userId);
  const res = await collection.count({ where: { page_id: pageId } });
  return typeof res === "number" ? res : 0;
}

async function ensurePageIngested({ userId, pageId, pageUrl, title, content, pdfContent, language }) {
  const existing = await countPageChunks({ userId, pageId });
  if (existing > 0) return existing;
  return upsertPage({ userId, pageId, pageUrl, title, content, pdfContent, language });
}

async function queryPage({ userId, pageId, query, topK = 6 }) {
  const collection = await getOrCreateUserCollection(userId);
  const [embedding] = await embedTexts([query]);
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where: { page_id: pageId },
    include: ["documents", "metadatas", "distances"],
  });
  const docs = (results.documents?.[0] || []).map((doc, idx) => ({
    text: doc,
    meta: results.metadatas?.[0]?.[idx] || {},
    distance: results.distances?.[0]?.[idx] || null,
  }));
  return docs;
}

module.exports = {
  chunkText,
  embedTexts,
  getOrCreateUserCollection,
  upsertPage,
  ensurePageIngested,
  queryPage,
};


