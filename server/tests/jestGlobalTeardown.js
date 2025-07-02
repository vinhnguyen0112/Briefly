const dbHelper = require("../helpers/dbHelper");
const { redisCluster } = require("../helpers/redisHelper");
const User = require("../models/user");
const jestVariables = require("./jestVariables");

/**
 * Delete all keys under the specified prefix in Redis Cluster
 */
async function deleteKeysWithPrefix(prefix) {
  try {
    if (!redisCluster.isOpen) {
      await redisCluster.connect();
    }

    const masters = redisCluster.masters;
    if (!masters) {
      throw new Error("No masters found in Redis cluster");
    }

    for (const node of masters) {
      let cursor = 0;
      do {
        const result = await node.client.scan(cursor, {
          MATCH: `${prefix}:*`,
          COUNT: 100,
        });
        cursor = Number(result.cursor);
        const keys = result.keys;

        if (keys.length > 0) {
          for (const key of keys) {
            await node.client.del(key);
            console.log(`Deleted key: ${key}`);
          }
        }
      } while (cursor !== 0);
    }

    console.log(`All keys under prefix "${prefix}" deleted successfully.`);
  } catch (err) {
    console.error("Error deleting keys with prefix:", err);
  }
}

module.exports = async () => {
  await redisCluster.connect();

  // Delete from MariaDB
  await dbHelper.executeQuery("DELETE FROM users");
  await dbHelper.executeQuery("DELETE FROM chats");
  await dbHelper.executeQuery("DELETE FROM anon_sessions");

  // Delete from Redis
  await deleteKeysWithPrefix(process.env.REDIS_PREFIX);

  await redisCluster.quit();
};
