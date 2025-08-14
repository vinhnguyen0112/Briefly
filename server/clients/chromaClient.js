let client;

async function getClient() {
  if (!client) {
    try {
      const { CloudClient } = await import("chromadb");
      client = new CloudClient({
        apiKey: process.env.CHROMA_API_KEY,
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
      });
    } catch (error) {
      console.error("Failed to initialize ChromaDB client:", error);
      throw new Error(`ChromaDB initialization failed: ${error.message}`);
    }
  }
  return client;
}

module.exports = { getClient };


