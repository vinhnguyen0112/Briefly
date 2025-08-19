const { QdrantClient } = require("@qdrant/js-client-rest");

let client;

/**
 * Returns the Qdrant client
 * @returns {Promise<QdrantClient>}
 */
async function getClient() {
  if (client) return client;

  if (process.env.NODE_ENV === "development_local") {
    // Local Qdrant (usually runs on port 6333 by default)
    client = new QdrantClient({
      url: "http://localhost:6333",
    });
    console.log("Connected to Qdrant local");
  } else if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "production"
  ) {
    // Remote Qdrant (Cloud/Self-hosted)
    client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
    console.log("Connected to Qdrant Cloud:", process.env.QDRANT_URL);
  }

  return client;
}

module.exports = { getClient };
