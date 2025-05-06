const redis = require("redis");

// Create redis cluster connection
const redisCluster = redis.createCluster({
  rootNodes: [
    { url: `redis://${process.env.REDIS_HOST_1}:${process.env.REDIS_PORT}` },
    { url: `redis://${process.env.REDIS_HOST_2}:${process.env.REDIS_PORT}` },
    { url: `redis://${process.env.REDIS_HOST_3}:${process.env.REDIS_PORT}` },
  ],
  defaults: {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
});

// Create an user session
const createSession = async (sessionData) => {
  const sessionId = crypto.randomUUID();
  const setResult = await redisCluster.set(
    `sess:${sessionId}`,
    JSON.stringify(sessionData),
    {
      EX: parseInt(process.env.SESSION_TTL),
    }
  );
  if (setResult !== "OK") throw new Error("Create session failed");
  return sessionId;
};

// Delete user session
const deleteSession = async (sessionId) => {
  const delResult = await redisCluster.del(`sess:${sessionId}`);
  return delResult > 0;
};

// Get user session
const getSession = async (sessionId) => {
  if (!sessionId) {
    return { isValid: false, message: "Session ID is required" };
  }

  const sessionData = await redisCluster.get(`sess:${sessionId}`);
  if (!sessionData) {
    return { isValid: false, message: "Session has expired" };
  }

  return { isValid: true, sessionData };
};

// Refresh session TTL
const refreshSession = async (sessionId) => {
  try {
    const exists = await redisCluster.exists(sessionId);
    if (!exists) {
      throw new Error("Session does not exist");
    }
    await redisCluster.expire(sessionId, parseInt(process.env.SESSION_TTL));
    console.log(`Session ${sessionId} refeshed`);
  } catch (error) {
    console.error("Error refreshing session:", error.message);
    throw error;
  }
};

module.exports = {
  redisCluster,
  createSession,
  getSession,
  refreshSession,
  deleteSession,
};
