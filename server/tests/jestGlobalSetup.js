require("dotenv").config({ path: ".env.test" });

const dbHelper = require("../helpers/dbHelper");
const { redisHelper, redisCluster } = require("../helpers/redisHelper");
const Session = require("../models/session");
const User = require("../models/user");
const { userId, name, sessionId } = require("./jestVariables");

module.exports = async () => {
  await redisCluster.connect();

  await User.create({
    id: userId,
    name: name,
  });

  await Session.create({
    id: sessionId,
    user_id: userId,
  });

  await redisHelper.createSession(sessionId, { user_id: userId });
};
