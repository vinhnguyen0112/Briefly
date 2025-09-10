const redis = require("redis");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");
const metricsService = require("../services/metricsService");

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

/**
 * Wrapper for Redis operations with metrics
 * @param {string} operation - The Redis operation name
 * @param {Function} fn - The Redis operation function
 * @returns {Promise} The result of the operation
 */
async function withMetrics(operation, fn) {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordRedisOperation(operation, "success", duration);
    return result;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordRedisOperation(operation, "error", duration);
    throw error;
  }
}

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

/**
 * Partially update a record in Redis by prefix and id.
 * Only updates the fields provided in 'updates'.
 * Preserves the original TTL.
 * @param {string} prefix
 * @param {string} id
 * @param {Object} updates
 * @returns {Object} The updated record
 */
async function updateRecord(prefix, id, updates) {
  const key = applyPrefix(`${prefix}:${id}`);

  // Get both the value and TTL
  const [existing, ttl] = await Promise.all([client.get(key), client.ttl(key)]);

  let record = {};

  if (existing) {
    try {
      record = JSON.parse(existing);
    } catch (e) {
      console.error("Failed to parse existing record:", e);
      record = {};
    }
  } else {
    return;
  }

  // Merge updates into existing record
  const updatedRecord = { ...record, ...updates };

  // Set with original TTL or default
  const setOptions = {};

  if (ttl > 0) {
    // Key has a TTL, preserve it
    setOptions.EX = ttl;
  } else if (ttl === -1) {
    // Key exists but has no expiration, don't set TTL
  } else {
    // Key doesn't exist (ttl === -2), set default TTL
    const defaultTtl = parseInt(process.env.SESSION_TTL) || 3600;
    setOptions.EX = defaultTtl;
  }

  await client.set(key, JSON.stringify(updatedRecord), setOptions);

  return updatedRecord;
}

const redisHelper = {
  client,
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  getSessionTTL,
  updateRecord,
};

module.exports = {
  client,
  redisHelper,
};
