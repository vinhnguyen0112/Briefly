const dbHelper = require("../helpers/dbHelper");
const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const User = require("../models/user");
const { userId, sessionId } = require("./jestVariables");

module.exports = async () => {
  await redisCluster.connect();

  await User.delete(userId);
  await redisHelper.deleteSession(sessionId);
  await dbHelper.executeQuery("DELETE FROM chats");
  await dbHelper.executeQuery("DELETE from anon_sessions");

  await redisCluster.quit();
};
