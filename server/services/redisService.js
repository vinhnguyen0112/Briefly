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

const RedisService = {
  async get(key) {
    try {
      const rawData = await redisClient.get(key);
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Redis GET error: ", err);
    }
  },

  async remove(key) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error("Redis DELETE error: ", err);
    }
  },

  async set(key, value, expiration = 60 * 60) {
    try {
      const data = JSON.stringify(value);
      await redisClient.set(key, data, { EX: expiration });
    } catch (err) {
      console.error("Redis SET error: ", err);
    }
  },
};

module.exports = { redisClient, RedisService };
