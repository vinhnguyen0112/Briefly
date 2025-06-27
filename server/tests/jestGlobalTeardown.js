const { redisHelper } = require("../helpers/redisHelper");
const User = require("../models/user");
const { userId, sessionId } = require("./jestVariables");

module.exports = async () => {
  await User.delete(userId);
  await redisHelper.deleteSession(sessionId);
};
