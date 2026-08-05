const express = require("express");
const { body } = require("express-validator");
const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

const redactSecretLikeText = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]").replace(/AIza[0-9A-Za-z_-]{8,}/g, "[redacted]");
};

const sanitizeProviderError = (error) => ({
  name: error?.name,
  message: redactSecretLikeText(error?.message),
  status: error?.status || error?.statusCode,
  code: redactSecretLikeText(error?.code || error?.errorCode),
});

router.post(
  "/test",
  [
    body("provider").isIn(["gemini", "openai"]).withMessage({ msg: "Provider must be gemini or openai", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    body("apiKey")
      .trim()
      .notEmpty()
      .withMessage({ msg: "API key is required", errorCode: ERROR_CODES.API_KEY_REQUIRED })
      .bail()
      .isLength({ min: 8, max: 4096 })
      .withMessage({ msg: "API key format is invalid", errorCode: ERROR_CODES.API_KEY_INVALID }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { provider, apiKey } = req.body;

    try {
      if (provider === "openai") {
        const client = new OpenAI({ apiKey });
        await client.models.list({ timeout: 10000 });
      } else {
        const client = new GoogleGenAI({ apiKey });
        await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: "Reply with OK.",
          config: {
            maxOutputTokens: 4,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });
      }

      res.json({
        valid: true,
        provider,
      });
    } catch (error) {
      console.warn("[API Key Test Failed]", {
        provider,
        error: sanitizeProviderError(error),
      });

      throw new AppError("Invalid API key", 401, ERROR_CODES.API_KEY_INVALID);
    }
  }),
);

module.exports = router;
