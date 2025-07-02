const config = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/jestGlobalSetup.js",
  globalTeardown: "<rootDir>/tests/jestGlobalTeardown.js",
  testTimeout: 10_000,
};

module.exports = config;
