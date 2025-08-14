let client;

async function getClient() {
  if (!client) {
    const { CloudClient } = await import("chromadb");
    client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
    });
  }
  return client;
}

module.exports = { getClient };


