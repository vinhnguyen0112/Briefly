const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT", // Bad/missing user data
  UNAUTHORIZED: "UNAUTHORIZED", // Not logged in or no permission
  FORBIDDEN: "FORBIDDEN", // Authenticated but blocked
  NOT_FOUND: "NOT_FOUND", // Resource doesn't exist
  CONFLICT: "CONFLICT", // Duplicate resource, etc.
  INTERNAL_ERROR: "INTERNAL_ERROR", // Fallback 500
};

module.exports = { ERROR_CODES };
