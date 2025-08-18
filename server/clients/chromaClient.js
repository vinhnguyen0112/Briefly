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
      path: "https://api.trychroma.com:8000",
      auth: {
        provider: "token",
        credentials: "ck-Hk4S3avz6BvbgovvsCTn3ueTjxrsjVqQBNUpgScjoVCt",
        tokenHeaderType: "X_CHROMA_TOKEN",
      },
      tenant: "a102252f-784d-452a-aaf3-3036799bbf02",
      database: "local_db",
    });
  } else {
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
