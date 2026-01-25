/**
 * Generate Routes
 * Handles AI code generation endpoints
 */

const express = require("express");
const { body } = require("express-validator");
const { generateCode } = require("../controllers/aiController");
const workshopGuard = require("../middleware/workshopGuard");
const validateRequest = require("../middleware/validateRequest");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

/**
 * Custom validator that attaches error code to validation error
 */
const withCode = (validationChain, errorCode) => {
  return validationChain.bail().customSanitizer((value, { req, location, path }) => {
    // Store error code in request for this field
    if (!req._validationErrorCodes) req._validationErrorCodes = {};
    req._validationErrorCodes[path] = errorCode;
    return value;
  });
};

/**
 * POST /api/generate
 * Generate code using Gemini AI
 *
 * Request body:
 * - password: Workshop access password
 * - visitorId: Unique identifier for the visitor/machine
 * - prompt: The code generation prompt
 * - messageHistory: (optional) Array of previous messages for context
 *
 * Response:
 * - code: Generated HTML/CSS/JS code
 * - remaining: Number of remaining requests
 */
router.post(
  "/",
  [
    body("password").trim().notEmpty().withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("visitorId")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Visitor ID is required", errorCode: ERROR_CODES.VISITOR_ID_REQUIRED })
      .bail()
      .isLength({ min: 8 })
      .withMessage({ msg: "Visitor ID must be at least 8 characters", errorCode: ERROR_CODES.VISITOR_ID_TOO_SHORT }),
    body("prompt")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Prompt is required", errorCode: ERROR_CODES.PROMPT_REQUIRED })
      .bail()
      .isLength({ min: 10 })
      .withMessage({ msg: "Prompt must be at least 10 characters", errorCode: ERROR_CODES.PROMPT_TOO_SHORT })
      .bail()
      .isLength({ max: 10000 })
      .withMessage({ msg: "Prompt must not exceed 10000 characters", errorCode: ERROR_CODES.PROMPT_TOO_LONG }),
    body("messageHistory").optional().isArray().withMessage({ msg: "Message history must be an array", errorCode: ERROR_CODES.MESSAGE_HISTORY_INVALID }),
    body("messageHistory.*.role")
      .optional()
      .isIn(["user", "assistant"])
      .withMessage({ msg: "Message role must be either 'user' or 'assistant'", errorCode: ERROR_CODES.MESSAGE_ROLE_INVALID }),
    body("messageHistory.*.content")
      .optional()
      .isString()
      .withMessage({ msg: "Message content must be a string", errorCode: ERROR_CODES.MESSAGE_CONTENT_INVALID })
      .bail()
      .isLength({ max: 5000 })
      .withMessage({ msg: "Message content must not exceed 5000 characters", errorCode: ERROR_CODES.MESSAGE_CONTENT_TOO_LONG }),
    validateRequest,
  ],
  workshopGuard,
  generateCode,
);

module.exports = router;
