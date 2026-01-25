/**
 * Request Validation Middleware
 * Processes express-validator results
 */

const { validationResult } = require("express-validator");
const { ERROR_CODES, createErrorResponse } = require("../constants/errorCodes");

/**
 * Validation middleware helper
 * Processes express-validator results and returns error if validation fails
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array();

    // Get the first error (most relevant)
    const firstError = validationErrors[0];

    // Handle both object and string message formats
    let errorCode = ERROR_CODES.VALIDATION_FAILED;
    let errorMessage = "Validation failed";

    if (typeof firstError.msg === "object" && firstError.msg.errorCode) {
      // Message is an object with errorCode
      errorCode = firstError.msg.errorCode;
      errorMessage = firstError.msg.msg;
    } else if (typeof firstError.msg === "string") {
      // Message is a plain string
      errorMessage = firstError.msg;
    }

    // Collect all error messages for details
    const errorMessages = validationErrors.map((err) => {
      if (typeof err.msg === "object" && err.msg.msg) {
        return err.msg.msg;
      }
      return err.msg;
    });

    return res.status(400).json(createErrorResponse(errorCode, errorMessage, errorMessages));
  }
  next();
};

module.exports = validateRequest;
