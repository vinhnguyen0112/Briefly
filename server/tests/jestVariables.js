const userId = 123;
const name = "test_account_1";
const sessionId = "123456789";
const nonexistSessionId = "987654321";
const invalidSessionId = sessionId.slice(0, sessionId.length - 2);

const jestVariables = {
  userId,
  name,
  sessionId,
  invalidSessionId,
  nonexistSessionId,
};

module.exports = jestVariables;
