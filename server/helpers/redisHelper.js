const redis = require("redis");

// Create redis cluster connection
// const redisCluster = redis.createCluster({
//   rootNodes: [
//     {
//       url: `redis://${process.env.REDIS_HOST_1}:${
//         process.env.REDIS_PORT || 6379
//       }`,
//     },
//     {
//       url: `redis://${process.env.REDIS_HOST_2}:${
//         process.env.REDIS_PORT || 6379
//       }`,
//     },
//     {
//       url: `redis://${process.env.REDIS_HOST_3}:${
//         process.env.REDIS_PORT || 6379
//       }`,
//     },
//   ],
//   defaults: {
//     username: process.env.REDIS_USERNAME,
//     password: process.env.REDIS_PASSWORD,
//   },
// });

// Local Redis (for development at home)
const redisCluster = redis.createClient({
  url: "redis://localhost:6379",
});

// Helper function to apply the prefix to keys
const applyPrefix = (key) => {
  const prefix = process.env.REDIS_PREFIX + ":" || "";
  return `${prefix}${key}`;
};

// Create a user session
const createSession = async (sessionData) => {
  const sessionId = crypto.randomUUID();
  const key = applyPrefix(`sess:${sessionId}`);
  console.log("REDIS KEY: ", key);
  const setResult = await redisCluster.set(key, JSON.stringify(sessionData), {
    EX: parseInt(process.env.SESSION_TTL),
  });
  if (setResult !== "OK") throw new Error("Create session failed");
  return sessionId;
};

// Delete user session
const deleteSession = async (sessionId) => {
  const key = applyPrefix(`sess:${sessionId}`);
  const delResult = await redisCluster.del(key);
  return delResult > 0;
};

// Get user session
const getSession = async (sessionId) => {
  if (!sessionId) {
    return { isValid: false, message: "Session ID is required" };
  }

  const key = applyPrefix(`sess:${sessionId}`);
  const sessionData = await redisCluster.get(key);
  if (!sessionData) {
    return { isValid: false, message: "Session has expired" };
  }

  return { isValid: true, sessionData };
};

// Refresh session TTL
const refreshSession = async (sessionId) => {
  try {
    const key = applyPrefix(`sess:${sessionId}`);
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

  const sessionData = await redisCluster.get(key);
  return sessionData ? JSON.parse(sessionData) : null;
};

const setAnonSession = async (sessionId, sessionData) => {
  const key = applyPrefix(`anon:${sessionId}`);

  const setResult = await redisCluster.set(key, JSON.stringify(sessionData), {
    EX: parseInt(process.env.SESSION_TTL),
  });
  if (setResult !== "OK") throw new Error("Create session failed");
  return sessionId;
};

// Refresh session TTL
const refreshAnonSession = async (sessionId) => {
  try {
    const key = applyPrefix(`anon:${sessionId}`);
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

const redisHelper = {
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  getAnonSession,
  setAnonSession,
  refreshAnonSession,
};

module.exports = {
  redisCluster,
  redisHelper,
};
