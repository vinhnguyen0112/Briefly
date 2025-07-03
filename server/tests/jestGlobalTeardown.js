const dbHelper = require("../helpers/dbHelper");
const { redisHelper } = require("../helpers/redisHelper");

/**
 * Delete all keys prefixed with provided 'prefix'
 * Works with single-node Redis client
 * @param {String} prefix
 */
async function clearTestRedis(prefix) {
  try {
    await redisHelper.client.connect();

    let cursor = 0;
    do {
      const result = await redisHelper.client.scan(cursor, {
        MATCH: `${prefix}:*`,
        COUNT: 100,
      });

      cursor = Number(result.cursor);
      const keys = result.keys;

      if (keys.length > 0) {
        for (const key of keys) {
          await redisHelper.client.del(key);
          console.log(`Deleted key: ${key}`);
        }
      }
    } while (cursor !== 0);

    console.log(`All keys under prefix "${prefix}" deleted successfully.`);
  } catch (err) {
    console.error("Error deleting keys with prefix:", err);
  } finally {
    await redisHelper.client.quit();
  }
}

/**
 * Delete everything from test database after tests are finished
 */
async function clearTestDatabase() {
  try {
    await dbHelper.executeQuery("DELETE FROM users");
    await dbHelper.executeQuery("DELETE FROM chats");
    await dbHelper.executeQuery("DELETE FROM anon_sessions");
  } catch (err) {
    console.error("Error deleting test database: ", err);
  }
}

module.exports = async () => {
  await clearTestDatabase();
  await clearTestRedis(process.env.REDIS_PREFIX);
};
