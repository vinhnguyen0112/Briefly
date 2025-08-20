/**
 * Centralized Qdrant API fetch helper.
 */
async function qdrantFetch(path, options = {}) {
  const url = `${process.env.QDRANT_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QDRANT_API_KEY}`,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Qdrant] ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

/**
 * Ensure a collection exists with multi-tenant configuration.
 * @param {string} collectionName
 * @param {number} vectorSize
 */
async function ensureCollection(collectionName, vectorSize = 1536) {
  try {
    await qdrantFetch(`/collections/${collectionName}`);
    console.log(`Collection "${collectionName}" already exists.`);
  } catch (err) {
    if (String(err).includes("404")) {
      console.log(`Collection "${collectionName}" not found, creating...`);

      // Create collection with multi-tenancy HNSW config
      await qdrantFetch(`/collections/${collectionName}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: "Cosine",
          },
        }),
      });

      // Define indexes:
      const indexes = [
        // true tenant identifier
        {
          field_name: "tenant_id",
          field_schema: {
            type: "keyword",
            is_tenant: true,
          },
        },
        // keep user_id and page_id for filtering/metadata
        {
          field_name: "user_id",
          field_schema: {
            type: "keyword",
          },
        },
        {
          field_name: "page_id",
          field_schema: {
            type: "keyword",
          },
        },
      ];

      for (const idx of indexes) {
        await qdrantFetch(`/collections/${collectionName}/index`, {
          method: "PUT",
          body: JSON.stringify(idx),
        });
      }

      console.log(
        `Collection "${collectionName}" created with indexes on tenant_id, user_id, and page_id.`
      );
    } else {
      throw err;
    }
  }
}

/**
 * Initialize all required collections for capstone2025.
 */
async function initializeCapstoneCollections(vectorSize) {
  await ensureCollection("capstone2025_response", vectorSize);
  await ensureCollection("capstone2025_page", vectorSize);
}

module.exports = {
  qdrantFetch,
  ensureCollection,
  initializeCapstoneCollections,
};
