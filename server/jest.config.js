const config = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/jestGlobalSetup.js",
  globalTeardown: "<rootDir>/tests/jestGlobalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 20_000,
};

module.exports = config;
