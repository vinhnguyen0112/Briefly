const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT", // Bad/missing user data
  UNAUTHORIZED: "UNAUTHORIZED", // Not logged in or no permission
  FORBIDDEN: "FORBIDDEN", // Authenticated but blocked
  NOT_FOUND: "NOT_FOUND", // Resource doesn't exist
  CONFLICT: "CONFLICT", // Duplicate resource, etc.
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR", // Services failure
  INTERNAL_ERROR: "INTERNAL_ERROR", // Fallback 500
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY", // MySQL duplicate entry
  REFERENCED_ROW_MISSING: "REFERENCED_ROW_MISSING", // MySQL foreign key error
  NULL_FIELD: "NULL_FIELD", // MySQL null field error,
  ROW_IS_REFERENCED: "ROW_IS_REFERENCED", // MySQL row is referenced error
};

module.exports = { ERROR_CODES };
