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
 * Ensure a collection exists with multi-tenant configuration and binary quantization.
 * @param {string} collectionName
 * @param {number} vectorSize
 * @param {boolean} enableBinaryQuantization
 */
async function ensureCollection(collectionName, vectorSize = 1536, enableBinaryQuantization = false) {
  try {
    await qdrantFetch(`/collections/${collectionName}`);
    console.log(`Collection "${collectionName}" already exists.`);
  } catch (err) {
    // More robust error detection for collection not found
    const isNotFound = err.message?.includes("404") || 
                      err.status === 404 || 
                      (err.response && err.response.status === 404);
    
    if (isNotFound) {
      console.log(`Collection "${collectionName}" not found, creating...`);

      const collectionConfig = {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      };

      // Add binary quantization configuration
      if (enableBinaryQuantization) {
        collectionConfig.quantization_config = {
          binary: {
            always_ram: true, // Keep quantized vectors in RAM for speed
            rescore: true, // Enable automatic rescoring for better accuracy
          },
        };
        console.log("Binary quantization enabled for collection with automatic rescoring");
      }

      // Create collection with multi-tenancy HNSW config
      await qdrantFetch(`/collections/${collectionName}`, {
        method: "PUT",
        body: JSON.stringify(collectionConfig),
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
async function initializeCapstoneCollections(vectorSize = 1536) {
  // Validate inputs
  if (!vectorSize || vectorSize <= 0 || vectorSize > 65536) {
    throw new Error(`Invalid vector size: ${vectorSize}. Must be between 1 and 65536.`);
  }
  
  // Safe environment variable parsing
  const binaryQuantEnv = process.env.QDRANT_ENABLE_BINARY_QUANTIZATION;
  const enableBinaryQuantization = binaryQuantEnv === 'true';
  
  if (binaryQuantEnv && binaryQuantEnv !== 'true' && binaryQuantEnv !== 'false') {
    console.warn(`Invalid QDRANT_ENABLE_BINARY_QUANTIZATION value: "${binaryQuantEnv}". Using default: false`);
  }
  
  try {
    await ensureCollection("capstone2025_response", vectorSize, enableBinaryQuantization);
    await ensureCollection("capstone2025_page", vectorSize, enableBinaryQuantization);
    
    if (enableBinaryQuantization) {
      console.log("All collections initialized with binary quantization enabled");
    } else {
      console.log("All collections initialized with standard configuration");
    }
  } catch (error) {
    console.error("Failed to initialize collections:", error);
    throw new Error(`Collection initialization failed: ${error.message}`);
  }
}

module.exports = {
  qdrantFetch,
  ensureCollection,
  initializeCapstoneCollections,
};
