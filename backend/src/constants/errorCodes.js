/**
 * Centralized Error Codes
 *
 * These codes are used for i18n translation on the frontend.
 * Each error code maps to a specific error scenario.
 */

const ERROR_CODES = {
  // Validation Errors (400)
  VALIDATION_FAILED: "VALIDATION_FAILED",
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  VISITOR_ID_REQUIRED: "VISITOR_ID_REQUIRED",
  VISITOR_ID_TOO_SHORT: "VISITOR_ID_TOO_SHORT",
  PROMPT_REQUIRED: "PROMPT_REQUIRED",
  PROMPT_TOO_SHORT: "PROMPT_TOO_SHORT",
  PROMPT_TOO_LONG: "PROMPT_TOO_LONG",
  MESSAGE_HISTORY_INVALID: "MESSAGE_HISTORY_INVALID",
  MESSAGE_ROLE_INVALID: "MESSAGE_ROLE_INVALID",
  MESSAGE_CONTENT_INVALID: "MESSAGE_CONTENT_INVALID",
  MESSAGE_CONTENT_TOO_LONG: "MESSAGE_CONTENT_TOO_LONG",
  INVALID_OBJECT_ID: "INVALID_OBJECT_ID",
  SAFETY_FILTER_BLOCKED: "SAFETY_FILTER_BLOCKED",

  // Authentication/Authorization Errors (401)
  PASSWORD_INVALID: "PASSWORD_INVALID",
  PASSWORD_EXPIRED: "PASSWORD_EXPIRED",

  // Conflict Errors (409)
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",

  // Rate Limiting Errors (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server/AI Errors (500)
  API_KEY_NOT_CONFIGURED: "API_KEY_NOT_CONFIGURED",
  API_KEY_INVALID: "API_KEY_INVALID",
  AI_RESPONSE_PARSE_FAILED: "AI_RESPONSE_PARSE_FAILED",
  AI_RESPONSE_INVALID: "AI_RESPONSE_INVALID",
  AI_GENERATION_FAILED: "AI_GENERATION_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  // Service Unavailable (503)
  API_QUOTA_EXCEEDED: "API_QUOTA_EXCEEDED",
};

/**
 * Create a standardized error response
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} message - Human-readable error message (fallback)
 * @param {Array<string>} details - Additional error details (for validation)
 * @returns {Object} Standardized error response
 */
function createErrorResponse(code, message, details = null) {
  const response = {
    errorCode: code,
    error: message,
  };

  if (details && details.length > 0) {
    response.details = details;
  }

  return response;
}

module.exports = {
  ERROR_CODES,
  createErrorResponse,
};
