const { ChromaClient, CloudClient } = require("chromadb");

let client;

/**
 * Returns the Chroma client
 * @returns {Promise<ChromaClient>}
 */
async function getClient() {
  if (client) return client;

  let config;
  if (process.env.NODE_ENV === "development_local") {
    client = new ChromaClient({
      path: "http://localhost:8000",
    });
    console.log("Connected to Chroma local");
  } else if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "production"
  ) {
    config = {
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
    };
    console.log("Connecting to Chroma Cloud:", config.database);
    client = new CloudClient(config);
  }

  return client;
}

module.exports = { getClient };
