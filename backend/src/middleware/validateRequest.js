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
    const errorMessages = errors.array().map((err) => err.msg);
    return res.status(400).json(createErrorResponse(ERROR_CODES.VALIDATION_FAILED, "Validation failed", errorMessages));
  }
  next();
};

module.exports = validateRequest;
