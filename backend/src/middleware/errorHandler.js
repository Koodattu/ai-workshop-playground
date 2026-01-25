/**
 * Global Error Handler Middleware
 * Provides consistent error response format
 */

const config = require("../config");
const { ERROR_CODES } = require("../constants/errorCodes");

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastError = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400, ERROR_CODES.INVALID_OBJECT_ID);
};

/**
 * Handle Mongoose duplicate key error
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`Duplicate value for field: ${field}`, 409, ERROR_CODES.DUPLICATE_ENTRY);
};

/**
 * Handle Mongoose validation error
 */
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join(", ")}`, 400, ERROR_CODES.VALIDATION_FAILED);
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging (never log sensitive data)
  if (config.nodeEnv === "development") {
    console.error("Error:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
  }

  // Handle specific Mongoose errors
  if (err.name === "CastError") {
    error = handleCastError(err);
  }

  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  if (err.name === "ValidationError") {
    error = handleValidationError(err);
  }

  // Default to 500 if status code not set
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || "Internal server error";
  const errorCode = error.errorCode || err.errorCode || (statusCode === 500 ? ERROR_CODES.INTERNAL_SERVER_ERROR : null);

  res.status(statusCode).json({
    error: message,
    ...(errorCode && { errorCode }),
    ...(config.nodeEnv === "development" && { stack: err.stack }),
  });
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
};
