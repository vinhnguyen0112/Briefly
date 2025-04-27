const redis = require("redis");

const redisClient = redis.createClient();

// Create an user session
const createSession = async (sessionData) => {
  const sessionId = crypto.randomUUID();
  const setResult = await redisClient.set(
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
  const delResult = await redisClient.del(`sess:${sessionId}`);
  return delResult > 0;
};

// Check if session exists
const checkSession = async (sessionId) => {
  if (!sessionId) {
    return { isValid: false, message: "Session ID is required" };
  }

  const sessionData = await redisClient.get(`sess:${sessionId}`);
  if (!sessionData) {
    return { isValid: false, message: "Session has expired" };
  }

  return { isValid: true, sessionData };
};

// Refresh session TTL
const refreshSession = async (sessionId) => {
  try {
    const exists = await redisClient.exists(sessionId);
    if (!exists) {
      throw new Error("Session does not exist");
    }
    await redisClient.expire(sessionId, parseInt(process.env.SESSION_TTL));
    console.log(`Session ${sessionId} refeshed`);
  } catch (error) {
    console.error("Error refreshing session:", error.message);
    throw error;
  }
};

module.exports = {
  redisClient,
  createSession,
  checkSession,
  refreshSession,
  deleteSession,
};
