const redis = require("redis");

// Create redis cluster connection
let redisCluster;

if (process.env.LOCAL_DEV === "true") {
  // Local Redis (for development)
  redisCluster = redis.createClient({
    url: "redis://localhost:6379",
  });
} else {
  // Redis Cluster (production/staging)
  redisCluster = redis.createCluster({
    rootNodes: [
      {
        url: `redis://${process.env.REDIS_HOST_1}:${
          process.env.REDIS_PORT || 6379
        }`,
      },
      {
        url: `redis://${process.env.REDIS_HOST_2}:${
          process.env.REDIS_PORT || 6379
        }`,
      },
      {
        url: `redis://${process.env.REDIS_HOST_3}:${
          process.env.REDIS_PORT || 6379
        }`,
      },
    ],
    defaults: {
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
    },
  });
}

// Helper function to apply the prefix to keys
const applyPrefix = (key) => {
  const prefix = process.env.REDIS_PREFIX + ":" || "";
  return `${prefix}${key}`;
};

// Create a user session with default values
const createSession = async (sessionId, sessionData) => {
  const key = applyPrefix(`auth:${sessionId}`);

  if (!sessionData.user_id) throw new Error("Missing user ID for session");
  if (!sessionData.id) throw new Error("Missing session ID for session");
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
    {
      EX: parseInt(process.env.SESSION_TTL),
    }
  );
  if (setResult !== "OK") throw new Error("Create session failed");

  return sessionId;
};

// Delete user session
const deleteSession = async (sessionId) => {
  const key = applyPrefix(`auth:${sessionId}`);
  const delResult = await redisCluster.del(key);
  return delResult > 0;
};

// Get user session from Redis, along with TTL
const getSession = async (sessionId) => {
  const key = applyPrefix(`auth:${sessionId}`);
  const [data, ttl] = await Promise.all([
    redisCluster.get(key),
    redisCluster.ttl(key),
  ]);

  return data
    ? {
        data: JSON.parse(data),
        ttl,
      }
    : null;
};

// Refresh session TTL
const refreshSession = async (sessionId) => {
  try {
    const key = applyPrefix(`auth:${sessionId}`);
    const exists = await redisCluster.exists(key);
    if (!exists) {
      throw new Error("Session does not exist");
    }
    await redisCluster.expire(key, parseInt(process.env.SESSION_TTL));
    console.log(`Session ${sessionId} refreshed`);
  } catch (error) {
    console.error("Error refreshing session:", error.message);
    throw error;
  }
};

const getAnonSession = async (sessionId) => {
  const key = applyPrefix(`anon:${sessionId}`);
  const [data, ttl] = await Promise.all([
    redisCluster.get(key),
    redisCluster.ttl(key),
  ]);

  return data
    ? {
        data: JSON.parse(data),
        ttl,
      }
    : null;
};

const createAnonSession = async (sessionId, sessionData) => {
  const key = applyPrefix(`anon:${sessionId}`);

  const setResult = await redisCluster.set(
    key,
    JSON.stringify({
      id: sessionId,
      anon_query_count: sessionData.anon_query_count,
    }),
    {
      EX: parseInt(process.env.SESSION_TTL),
    }
  );
  if (setResult !== "OK") throw new Error("Create session failed");
  return sessionId;
};

// Refresh session TTL
const refreshAnonSession = async (sessionId) => {
  const key = applyPrefix(`anon:${sessionId}`);
  const exists = await redisCluster.exists(key);
  if (!exists) {
    throw new Error("Session does not exist");
  }
  await redisCluster.expire(key, parseInt(process.env.SESSION_TTL));
  console.log(`Session ${sessionId} refreshed`);
};

const deleteAnonSession = async (sessionId) => {
  const key = applyPrefix(`anon:${sessionId}`);
  const delResult = await redisCluster.del(key);
  return delResult > 0;
};

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
