/**
 * Validation Helpers
 * Custom validators and error formatters for express-validator
 */

const { ERROR_CODES } = require("../constants/errorCodes");

/**
 * Custom withMessage wrapper that attaches error codes to validation errors
 * @param {string} message - The error message
 * @param {string} errorCode - The error code from ERROR_CODES
 * @returns {Function} Formatter function for express-validator
 */
const withErrorCode = (message, errorCode) => {
  return (value, { req, path }) => {
    const error = new Error(message);
    error.errorCode = errorCode;
    throw error;
  };
};

/**
 * Create a custom error formatter that includes error codes
 */
const customErrorFormatter = (error) => {
  return {
    msg: error.msg,
    param: error.param,
    location: error.location,
    value: error.value,
    errorCode: error.errorCode || ERROR_CODES.VALIDATION_FAILED,
  };
};

module.exports = {
  withErrorCode,
  customErrorFormatter,
  ERROR_CODES,
};
