require("dotenv").config({ path: ".env.test" });

const dbHelper = require("../helpers/dbHelper");
const { v4: uuidv4 } = require("uuid");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");
const User = require("../models/user");

const userId = 123;
const name = "test_account_1";
const sessionId = uuidv4();

beforeAll(async () => {
  await User.create({
    id: userId,
    name,
  });

  await Session.create({
    id: sessionId,
    user_id: userId,
  });

  await redisHelper.createSession(sessionId, { user_id: userId });
});

afterAll(async () => {
  await User.delete(userId);
  await redisHelper.deleteSession(sessionId);
});

const jestVariables = { userId, name, sessionId };

module.exports = jestVariables;
