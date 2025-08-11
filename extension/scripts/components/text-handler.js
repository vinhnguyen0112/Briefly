/**
 * Clean DOM content
 * @param {String} domContent - Raw DOM content
 * @returns {String} Sanitized DOM content
 */
export function formatDomContent(domContent) {
  if (!domContent) return null;

  return (
    sanitizeForJson(domContent)
      // Additional DOM-specific cleaning
      .replace(/&nbsp;/g, " ") // Replace HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

      // Remove multiple spaces and normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Sanitize string content for safe JSON storage
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeForJson(str) {
  if (!str || typeof str !== "string") return str;

  return (
    str
      // Remove control characters except newlines, carriage returns, and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

      // Handle special characters that could break JSON
      .replace(/\\/g, "\\\\") // Escape backslashes first
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, "\\n") // Escape newlines for JSON
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\t/g, "\\t") // Escape tabs

      // Remove or replace other problematic characters
      .replace(/[\u0000-\u001F]/g, "") // Remove remaining control characters
      .replace(/[\uFFFE\uFFFF]/g, "") // Remove invalid Unicode characters

      // Trim excessive whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
