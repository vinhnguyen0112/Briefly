const crypto = require("crypto");
const normalizeUrl = require("normalize-url").default;

/**
 * Hashes any number of arguments into a single SHA-256 hex string.
 * Skips undefined/null values.
 */
function generateHash(...args) {
  const input = args.filter((v) => v !== undefined && v !== null).join(":");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateName() {
  const NAME_PREFIX = "Briefly_User_";
  const uniquePart = crypto.randomBytes(8).toString("hex");
  return NAME_PREFIX + uniquePart;
}

function processUrl(url) {
  const normalizedUrl = normalizeUrl(url, {
    removeQueryParameters: true,
  });
  return normalizedUrl;
}

const commonHelper = {
  generateHash,
  generateName,
  processUrl,
};

module.exports = commonHelper;
