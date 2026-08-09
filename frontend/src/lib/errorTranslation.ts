/**
 * Error Translation Utility
 * Translates error codes from backend into localized error messages
 */

/**
 * Get translated error message for an error code
 * @param errorCode - Error code from backend (e.g., "RATE_LIMIT_EXCEEDED")
 * @param t - Translation function from LanguageContext
 * @param fallbackMessage - Optional fallback message if translation not found
 * @returns Translated error message
 */
export function getErrorMessage(errorCode: string | undefined, t: (key: string) => string, fallbackMessage?: string): string {
  // If no error code provided, return fallback or unknown error
  if (!errorCode) {
    return fallbackMessage || t("chat.errors.UNKNOWN_ERROR");
  }

  // Try to get the translation for the error code
  const translationKey = `chat.errors.${errorCode}`;
  const translatedMessage = t(translationKey);

  // If translation returns the key itself (not found), use fallback
  if (translatedMessage === translationKey) {
    return fallbackMessage || t("chat.errors.UNKNOWN_ERROR");
  }

  return translatedMessage;
}

/**
 * Extract error information from API error response
 * @param error - Error object or string from API
 * @returns Object with errorCode, message, and details
 */
export function parseApiError(error: unknown): {
  errorCode?: string;
  message: string;
  details?: string[];
} {
  // If error is already a parsed object with errorCode
  if (error && typeof error === "object") {
    const apiError = error as Record<string, unknown>;
    return {
      errorCode: typeof apiError.errorCode === "string" ? apiError.errorCode : undefined,
      message: typeof apiError.error === "string" ? apiError.error : typeof apiError.message === "string" ? apiError.message : "Unknown error",
      details: Array.isArray(apiError.details) && apiError.details.every((detail) => typeof detail === "string") ? apiError.details : undefined,
    };
  }

  // If error is a string, it might be the error message
  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: "Unknown error",
  };
}
