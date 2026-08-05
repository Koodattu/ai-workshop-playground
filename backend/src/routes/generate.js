/**
 * Generate Routes
 * Handles AI code generation endpoints
 */

const express = require("express");
const { body } = require("express-validator");
const { generateCode } = require("../controllers/aiController");
const workshopGuard = require("../middleware/workshopGuard");
const { apiKeyAuth } = require("../middleware/apiKeyAuth");
const validateRequest = require("../middleware/validateRequest");
const { ERROR_CODES } = require("../constants/errorCodes");
const { MODEL_PREFERENCE_IDS } = require("../services/modelSettings");

const router = express.Router();
const isApiKeyMode = (value, { req }) => req.body.authMode === "api-key";

const generationAuth = (req, res, next) => {
  if (req.body.authMode === "api-key") {
    return apiKeyAuth(req, res, next);
  }

  return workshopGuard(req, res, next);
};

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
 * Generate code using the selected AI model
 *
 * Request body:
 * - password: Workshop access password
 * - visitorId: Unique identifier for the visitor/machine
 * - prompt: The code generation prompt
 * - messageHistory: (optional) Array of previous messages for context
 * - modelPreference: (optional) model preference ID exposed by the model settings service
 *
 * Response:
 * - code: Generated HTML/CSS/JS code
 * - remaining: Number of remaining requests
 */
router.post(
  "/",
  [
    body("authMode").optional().isIn(["password", "api-key"]).withMessage({ msg: "Auth mode is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("password")
      .if((value, { req }) => req.body.authMode !== "api-key")
      .trim()
      .notEmpty()
      .withMessage({ msg: "Workshop password is required", errorCode: ERROR_CODES.PASSWORD_REQUIRED }),
    body("apiKeyAccessToken")
      .if(isApiKeyMode)
      .trim()
      .notEmpty()
      .withMessage({ msg: "API key session token is required", errorCode: ERROR_CODES.VALIDATION_FAILED })
      .bail()
      .isLength({ min: 24, max: 200 })
      .withMessage({ msg: "API key session token is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("apiKeys").if(isApiKeyMode).optional().isObject().withMessage({ msg: "API keys must be an object", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("apiKeys.gemini")
      .if(isApiKeyMode)
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 4096 })
      .withMessage({ msg: "Gemini API key is too long", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("apiKeys.openai")
      .if(isApiKeyMode)
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 4096 })
      .withMessage({ msg: "OpenAI API key is too long", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("apiKeys.deepseek")
      .if(isApiKeyMode)
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 4096 })
      .withMessage({ msg: "DeepSeek API key is too long", errorCode: ERROR_CODES.VALIDATION_FAILED }),
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
    body("existingCode").optional().isString().withMessage({ msg: "Existing code must be a string", errorCode: ERROR_CODES.VALIDATION_FAILED }).isLength({ max: 500000 }),
    body("parentVersionId").optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage({ msg: "Parent version ID is invalid", errorCode: ERROR_CODES.INVALID_OBJECT_ID }),
    body("mode").optional().isIn(["edit", "ask"]).withMessage({ msg: "Mode must be either 'edit' or 'ask'", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("showThoughts").optional().isBoolean().withMessage({ msg: "Show thoughts must be a boolean", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("modelPreference")
      .optional()
      .isIn(MODEL_PREFERENCE_IDS)
      .withMessage({ msg: "Model preference is invalid", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    validateRequest,
  ],
  generationAuth,
  generateCode,
);

module.exports = router;
