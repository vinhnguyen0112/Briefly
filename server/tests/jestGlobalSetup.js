require("dotenv").config({ path: ".env.test" });

const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const Session = require("../models/session");
const User = require("../models/user");
const { userId, name, sessionId } = require("./jestVariables");

module.exports = async () => {
  await redisCluster.connect();

  // Create a global user and authenticated session for test cases
  await User.create({
    id: userId,
    name: name,
  });
  await Session.create({
    id: sessionId,
    user_id: userId,
  });
  await redisHelper.createSession({ id: sessionId, user_id: userId }, "auth");

  await redisCluster.quit();
};
