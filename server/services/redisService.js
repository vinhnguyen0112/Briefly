const redis = require("redis");

const redisClient = redis.createClient();
redisClient
  .connect()
  .then(() => {
    console.log("Redis connected sucessfully!");
  })
  .catch((err) => {
    console.error("Failed to connect to Redis: ", err);
    process.exit(1);
  });

const refreshSession = async (sessionId) => {
  const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
  try {
    const exists = await redisClient.exists(sessionId);

    if (!exists) {
      throw new Error("Session does not exist");
    }

    await redisClient.expire(sessionId, SESSION_TTL);
    console.log(
      `Session ${sessionId} lifetime reset to ${SESSION_TTL} seconds.`
    );
  } catch (error) {
    console.error("Error resetting session lifetime:", error.message);
    throw error;
  }
};

module.exports = { redisClient, refreshSession };
