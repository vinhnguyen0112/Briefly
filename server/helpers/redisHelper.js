const redis = require("redis");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

const redisCluster = redis.createCluster({
  rootNodes: process.env.REDIS_HOST.split(",").map((host) => ({
    url: `redis://${host}:${process.env.REDIS_PORT}`,
  })),
  defaults: {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
});

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
 * Creates a new authenticated session in Redis.
 * @param {String} sessionId The session ID.
 * @param {Object} sessionData The session data.
 * @param {string} [sessionData.user_id]
 * @param {number} [sessionData.query_count]
 * @param {number} [sessionData.token_count]
 * @param {number} [sessionData.maximum_response_length]
 * @param {string} [sessionData.response_style]
 * @throws If required data is missing or Redis fails.
 */
const createSession = async (sessionId, sessionData = {}) => {
  if (!sessionId) {
    throw new AppError(
      ERROR_CODES.INVALID_INPUT,
      "Missing session ID for session"
    );
  }
  if (!sessionData.user_id) {
    throw new AppError(
      ERROR_CODES.INVALID_INPUT,
      "Missing user ID for session"
    );
  }

  let sessionTTL;
  if (sessionData.expires_at) {
    const expiresAtMs = new Date(sessionData.expires_at).getTime();
    const nowMs = Date.now();
    sessionTTL = Math.ceil((expiresAtMs - nowMs) / 1000);
    if (sessionTTL <= 0) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        `Session has already expired at: (${sessionData.expires_at})`
      );
    }
    console.log("Computed custom TTL for session:", sessionTTL);
  }

  if (!sessionTTL || isNaN(sessionTTL)) {
    sessionTTL = parseInt(process.env.SESSION_TTL, 10);
  }

  const key = applyPrefix(`auth:${sessionId}`);
  const setResult = await redisCluster.set(
    key,
    JSON.stringify({
      id: sessionId,
      user_id: sessionData.user_id,
      query_count: sessionData.query_count ?? 0,
      token_count: sessionData.token_count ?? 0,
      maximum_response_length: sessionData.maximum_response_length || 150,
      response_style: sessionData.response_style || 1,
    }),
    { EX: sessionTTL }
  );

  if (setResult !== "OK") {
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to create session in Redis",
      401
    );
  }
};

/**
 * Deletes an authenticated session from Redis.
 * @param {String} sessionId The session ID.
 * @returns {Promise<void>}
 */
const deleteSession = async (sessionId) => {
  const key = applyPrefix(`auth:${sessionId}`);
  await redisCluster.del(key);
};

/**
 * Retrieves an authenticated session from Redis, including TTL.
 * @param {String} sessionId The session ID.
 * @returns {Promise<Object|null>} The session data with TTL, or null if not found.
 */
const getSession = async (sessionId) => {
  const key = applyPrefix(`auth:${sessionId}`);
  const [data, ttl] = await Promise.all([
    redisCluster.get(key),
    redisCluster.ttl(key),
  ]);
  return data
    ? {
        ...JSON.parse(data),
        ttl,
      }
    : null;
};

/**
 * Refreshes the TTL of an authenticated session in Redis.
 * @param {String} sessionId The session ID.
 * @returns {Promise<void>}
 * @throws If the session does not exist or Redis fails.
 */
const refreshSession = async (sessionId) => {
  try {
    const key = applyPrefix(`auth:${sessionId}`);
    const exists = await redisCluster.exists(key);
    if (!exists) {
      return;
    }
    await redisCluster.expire(key, parseInt(process.env.SESSION_TTL));
    console.log(`Session ${sessionId} refreshed`);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to refresh session TTL",
      401
    );
  }
};

/**
 * Retrieves an anonymous session from Redis, including TTL.
 * @param {String} sessionId - The session ID.
 * @returns {Promise<Object|null>} The session data with TTL, or null if not found.
 */
const getAnonSession = async (sessionId) => {
  const key = applyPrefix(`anon:${sessionId}`);
  const [data, ttl] = await Promise.all([
    redisCluster.get(key),
    redisCluster.ttl(key),
  ]);
  return data
    ? {
        ...JSON.parse(data),
        ttl,
      }
    : null;
};

/**
 * Creates a new anonymous session in Redis.
 * @param {String} sessionId The session ID.
 * @param {Object} sessionData The session data.
 * @throws If session ID is missing or Redis fails.
 */
const createAnonSession = async (sessionId, sessionData) => {
  if (!sessionId) {
    throw new AppError(
      ERROR_CODES.INVALID_INPUT,
      "Missing session ID for anon session"
    );
  }
  const key = applyPrefix(`anon:${sessionId}`);
  const setResult = await redisCluster.set(
    key,
    JSON.stringify({
      id: sessionId,
      anon_query_count: sessionData.anon_query_count ?? 0,
    }),
    {
      EX: parseInt(process.env.SESSION_TTL),
    }
  );
  if (setResult !== "OK") {
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to create anon session in Redis",
      401
    );
  }
};

/**
 * Refreshes the TTL of an anonymous session in Redis.
 * @param {String} sessionId The session ID.
 * @returns {Promise<void>}
 * @throws If the session does not exist or Redis fails.
 */
const refreshAnonSession = async (sessionId) => {
  try {
    const key = applyPrefix(`anon:${sessionId}`);
    const exists = await redisCluster.exists(key);
    if (!exists) {
      return;
    }
    await redisCluster.expire(key, parseInt(process.env.SESSION_TTL));
    console.log(`Anon session ${sessionId} refreshed`);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      "Failed to refresh anon session TTL",
      401
    );
  }
};

/**
 * Deletes an anonymous session from Redis.
 * @param {String} sessionId The session ID.
 */
const deleteAnonSession = async (sessionId) => {
  const key = applyPrefix(`anon:${sessionId}`);
  await redisCluster.del(key);
};

/**
 * Retrieves any session from Redis by its full prefixed key, including TTL.
 * @param {String} prefixedKey The full prefixed Redis key.
 * @returns {Promise<Object|null>} The session data with TTL, or null if not found.
 */
const getAnySession = async (prefixedKey) => {
  const [data, ttl] = await Promise.all([
    redisCluster.get(prefixedKey),
    redisCluster.ttl(prefixedKey),
  ]);
  return data
    ? {
        data: JSON.parse(data),
        ttl,
      }
    : null;
};

const redisHelper = {
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  getAnonSession,
  createAnonSession,
  refreshAnonSession,
  deleteAnonSession,
  getAnySession,
};

module.exports = {
  redisCluster,
  redisHelper,
};
