const crypto = require("crypto");
const normalizeUrl = require("normalize-url");

/**
 * Generates a SHA256 hash from the provided arguments.
 * @param {...any} args The values to hash.
 * @returns {String} The resulting SHA256 hash as a hex string.
 */
function generateHash(...args) {
  // Filters out undefined and null values, joins them with ":", and hashes the result.
  const input = args.filter((v) => v !== undefined && v !== null).join(":");
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generates a unique user name with a fixed prefix and a random hex string.
 * @returns {String} The generated user name.
 */
function generateName() {
  const NAME_PREFIX = "Briefly_User_";
  const uniquePart = crypto.randomBytes(8).toString("hex");
  return NAME_PREFIX + uniquePart;
}

/**
 * Normalizes a URL using "normalize-url" package.
 * @param {String} url The URL to normalize.
 * @returns {String} The normalized URL.
 */
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
