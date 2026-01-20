/**
 * Request Validation Middleware
 * Processes express-validator results
 */

const { validationResult } = require("express-validator");

/**
 * Validation middleware helper
 * Processes express-validator results and returns error if validation fails
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    return res.status(400).json({
      error: "Validation failed",
      details: errorMessages,
    });
  }
  next();
};

module.exports = validateRequest;
