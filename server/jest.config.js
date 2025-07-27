const config = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/jestGlobalSetup.js",
  globalTeardown: "<rootDir>/tests/jestGlobalTeardown.js",
  testTimeout: 20_000,
  verbose: true,
  testPathIgnorePatterns: ["queryAPI.test.js"], // Exclude out queryAPI
};

module.exports = config;
