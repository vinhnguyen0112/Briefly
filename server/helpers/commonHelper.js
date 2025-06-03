const crypto = require("crypto");

// TODO: Test generateHash with authentication

/**
 * Hashes any number of arguments into a single SHA-256 hex string.
 * Skips undefined/null values.
 */
function generateHash(...args) {
  const input = args.filter((v) => v !== undefined && v !== null).join(":");
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = { generateHash };
