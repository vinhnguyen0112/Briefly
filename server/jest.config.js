const config = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/jestGlobalSetup.js",
  globalTeardown: "<rootDir>/tests/jestGlobalTeardown.js",
  testTimeout: 5_000,
  verbose: true,
  testPathIgnorePatterns: ["queryAPI.test.js"], // Exclude out queryAPI
};

module.exports = config;
