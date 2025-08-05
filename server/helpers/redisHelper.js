const redis = require("redis");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

// Redis initialization
let client;
if (
  process.env.NODE_ENV === "test" ||
  process.env.NODE_ENV === "development_local"
) {
  // Single-node Redis for testing
  client = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}`,
  });

  client.on("error", (err) => console.error("Redis Client Error", err));
} else {
  // client Redis for dev/prod
  client = redis.createCluster({
    rootNodes: process.env.REDIS_HOST.split(",").map((host) => ({
      url: `redis://${host}`,
    })),
    defaults: {
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
    },
  });

  client.on("error", (err) => console.error("Redis client Error", err));
}

/**
 * Applies a prefix to a Redis key.
 * @param {String} key The key to prefix.
 * @returns {String} The prefixed key.
 */
const applyPrefix = (key) => {
  const prefix = process.env.REDIS_PREFIX ? process.env.REDIS_PREFIX + ":" : "";
  return `${prefix}${key}`;
};

// SESSION MANAGEMENT

/**
 * Builds the JSON payload for session storage depending on session type.
 * @param {Object} sessionData
 * @param {"auth"|"anon"} type
 * @returns {Object}
 */
function buildSessionPayload(sessionData, type) {
  if (type === "auth") {
    if (!sessionData.user_id) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing user_id for authenticated session"
      );
    }
    return {
      id: sessionData.id,
      user_id: sessionData.user_id,
      query_count: sessionData.query_count ?? 0,
      token_count: sessionData.token_count ?? 0,
      maximum_response_length: sessionData.maximum_response_length || 150,
      response_style: sessionData.response_style || 1,
    };
  } else if (type === "anon") {
    return {
      id: sessionData.id,
      anon_query_count: sessionData.anon_query_count ?? 0,
    };
  } else {
    throw new AppError(ERROR_CODES.INVALID_INPUT, "Unknown session type");
  }
}

/**
 * Computes TTL based on expires_at.
 * Fallback to default value if expires_at is missing or invalid
 * @param {Object} sessionData
 * @returns {number}
 */
function computeTTL(sessionData) {
  let sessionTTL;
  if (sessionData.expires_at) {
    const expiresAt = new Date(sessionData.expires_at);
    if (!isNaN(expiresAt.getTime())) {
      const expiresAtMs = expiresAt.getTime();
      const nowMs = Date.now();
      sessionTTL = Math.ceil((expiresAtMs - nowMs) / 1000);
      if (sessionTTL <= 0) {
        throw new AppError(
          ERROR_CODES.INVALID_INPUT,
          `Session has already expired at: (${sessionData.expires_at})`
        );
      }
    } else {
      console.warn(
        `Invalid expires_at value (${sessionData.expires_at}), using default TTL`
      );
    }
  }

  if (!sessionTTL || isNaN(sessionTTL)) {
    sessionTTL = parseInt(process.env.SESSION_TTL, 10);
  }
  return sessionTTL;
}

/**
 * Creates a session (auth or anon) in Redis.
 * @param {Object} sessionData The session data
 * @param {Object} [sessionData.id]
 * @param {Object} [sessionData.user_id]
 * @param {Object} [sessionData.anon_query_count]
 * @param {Object} [sessionData.query_count]
 * @param {Object} [sessionData.token_count]
 * @param {Object} [sessionData.maximum_response_length]
 * @param {Object} [sessionData.response_style]
 * @param {"auth"|"anon"} type Session type
 * @throws if sessionData is invalid or type is unknown
 */
async function createSession(sessionData, type) {
  if (!sessionData.id) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing session ID");
  }

  if (type !== "anon" && type !== "auth") {
    throw new AppError(ERROR_CODES.INVALID_INPUT, "Invalid session type");
  }

  const ttl = computeTTL(sessionData);
  const key = applyPrefix(`${type}:${sessionData.id}`);
  const payload = buildSessionPayload(sessionData, type);

  await client.set(key, JSON.stringify(payload), { EX: ttl });
}

/**
 * Retrieves a session from Redis including TTL.
 * @param {String} sessionId
 * @param {"auth"|"anon"} type
 * @returns {Promise<Object|null>} parsed sessionData with ttl
 */
async function getSession(sessionId, type) {
  const key = applyPrefix(`${type}:${sessionId}`);
  const [data, ttl] = await Promise.all([client.get(key), client.ttl(key)]);

  return data ? { ...JSON.parse(data), ttl } : null;
}

/**
 * Refreshes the TTL of a session in Redis
 * @param {String} sessionId
 * @param {"auth"|"anon"} type
 */
async function refreshSession(sessionId, type) {
  try {
    const key = applyPrefix(`${type}:${sessionId}`);
    const exists = await client.exists(key);
    if (!exists) {
      return;
    }
    await client.expire(key, parseInt(process.env.SESSION_TTL, 10));
    console.log(`Session ${sessionId} (type: ${type}) refreshed`);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to refresh session TTL",
      401
    );
  }
}

/**
 * Deletes a session from Redis
 * @param {String} sessionId
 * @param {"auth"|"anon"} type
 */
async function deleteSession(sessionId, type) {
  const key = applyPrefix(`${type}:${sessionId}`);
  await client.del(key);
}

/**
 * Gets TTL for a given session
 * @param {String} sessionId
 * @param {"auth"|"anon"} type
 * @returns {Promise<number|null>}
 */
async function getSessionTTL(sessionId, type) {
  const key = applyPrefix(`${type}:${sessionId}`);
  const ttl = await client.ttl(key);
  return ttl >= 0 ? ttl : null;
}

// PAGE METADATA MANAGEMENT

/**
 * Check if a page is already cached in Redis
 * @param {string} pageId
 * @returns {Promise<boolean>}
 */
async function isPageCached(pageId) {
  const key = applyPrefix(`page:${pageId}`);
  return (await client.exists(key)) === 1;
}

/**
 * Get a page record from Redis
 * Returns null if not found
 * @param {string} pageId
 * @returns {Promise<Object|null>}
 */
async function getPage(pageId) {
  const key = applyPrefix(`page:${pageId}`);
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

/**
 * Store page record in Redis or overwrite if pageId exists
 * @param {string} pageId
 * @param {Object} pageMetadata
 * @param {String} pageMetadata.page_url
 * @param {String} pageMetadata.normalized_page_url
 * @param {String} pageMetadata.title
 * @param {String} pageMetadata.page_content
 */
async function setPage(pageId, pageMetadata) {
  const key = applyPrefix(`page:${pageId}`);
  await client.set(key, JSON.stringify(pageMetadata), {
    EX: process.env.SESSION_TTL,
  });
}

/**
 * Remove page cache from Redis
 * @param {string} pageId
 */
async function deletePage(pageId) {
  const key = applyPrefix(`page:${pageId}`);
  await client.del(key);
}

// PAGE SUMMARY MANAGEMENT

/**
 * Get page summary from Redis
 * Returns null if not found
 * @param {string} pageId
 * @param {string} language
 * @returns {Promise<string|null>}
 */
async function getPageSummary(pageId, language) {
  const key = applyPrefix(`page_summary:${pageId}:${language}`);
  const value = await client.get(key);
  return value ?? null;
}

/**
 * Set page summary in Redis
 * @param {Object} pageSummary
 * @param {string} pageSummary.pageId
 * @param {string} pageSummary.language
 * @param {string} pageSummary.summary
 */
async function setPageSummary(pageSummary) {
  const key = applyPrefix(
    `page_summary:${pageSummary.pageId}:${pageSummary.language}`
  );
  await client.set(key, pageSummary.summary, { EX: process.env.SUMMARY_TTL });
}

/**
 * Delete all summaries under a given pageId
 * @param {string} pageId
 * @returns {Promise<number>} Number of deleted keys
 */
/**
 * Delete all summaries under a given pageId
 * @param {string} pageId
 * @returns {Promise<number>} Number of deleted keys
 */
async function deletePageSummaries(pageId) {
  const pattern = applyPrefix(`page_summary:${pageId}:*`);
  let totalDeleted = 0;

  try {
    // Check if this is a Redis Cluster
    if (client.masters && Array.isArray(client.masters)) {
      // Redis Cluster - scan each master node
      for (const master of client.masters) {
        const nodeClient = master.client;

        if (nodeClient.scanIterator) {
          // Use scanIterator if available
          const iterator = nodeClient.scanIterator({
            MATCH: pattern,
            COUNT: 100,
          });

          const keysToDelete = [];
          for await (const key of iterator) {
            keysToDelete.push(key);

            // Delete in batches to avoid memory issues
            if (keysToDelete.length >= 100) {
              await nodeClient.DEL(keysToDelete);
              totalDeleted += keysToDelete.length;
              keysToDelete.length = 0;
            }
          }

          // Delete remaining keys
          if (keysToDelete.length > 0) {
            await nodeClient.DEL(keysToDelete);
            totalDeleted += keysToDelete.length;
          }
        } else {
          // Fallback to SCAN for this node
          let cursor = 0;
          do {
            const result = await nodeClient.SCAN(cursor, {
              MATCH: pattern,
              COUNT: 100,
            });
            cursor = result.cursor;
            const keys = result.keys;

            if (keys.length > 0) {
              await nodeClient.DEL(keys);
              totalDeleted += keys.length;
            }
          } while (cursor !== 0);
        }
      }
    } else {
      // Single Redis instance
      if (client.scanIterator) {
        const iterator = client.scanIterator({
          MATCH: pattern,
          COUNT: 100,
        });

        const keysToDelete = [];
        for await (const key of iterator) {
          keysToDelete.push(key);

          if (keysToDelete.length >= 100) {
            await client.DEL(keysToDelete);
            totalDeleted += keysToDelete.length;
            keysToDelete.length = 0;
          }
        }

        if (keysToDelete.length > 0) {
          await client.DEL(keysToDelete);
          totalDeleted += keysToDelete.length;
        }
      } else {
        // Fallback to regular SCAN
        let cursor = 0;
        do {
          const result = await client.SCAN(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          cursor = result.cursor;
          const keys = result.keys;

          if (keys.length > 0) {
            await client.DEL(keys);
            totalDeleted += keys.length;
          }
        } while (cursor !== 0);
      }
    }
  } catch (error) {
    console.error("Error deleting page summaries:", error);
    throw error;
  }

  console.log(`Deleted ${totalDeleted} keys for pageId: ${pageId}`);
  return totalDeleted;
}

const redisHelper = {
  client,
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  getSessionTTL,
  getPage,
  isPageCached,
  setPage,
  deletePage,
  getPageSummary,
  setPageSummary,
  deletePageSummaries,
};

module.exports = {
  client,
  redisHelper,
};
