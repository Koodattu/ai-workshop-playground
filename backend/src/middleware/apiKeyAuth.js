const crypto = require("crypto");
const { AppError, asyncHandler } = require("./errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");

const trimKey = (value) => (typeof value === "string" ? value.trim() : "");

const hashAccessToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getApiKeyAuthPayload = (req) => {
  const apiKeys = req.body.apiKeys || {};
  return {
    visitorId: trimKey(req.body.visitorId),
    accessToken: trimKey(req.body.apiKeyAccessToken),
    apiKeys: {
      gemini: trimKey(apiKeys.gemini),
      openai: trimKey(apiKeys.openai),
      deepseek: trimKey(apiKeys.deepseek),
    },
  };
};

const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const { visitorId, accessToken, apiKeys } = getApiKeyAuthPayload(req);

  if (!visitorId) {
    throw new AppError("Visitor ID is required", 400, ERROR_CODES.VISITOR_ID_REQUIRED);
  }

  if (!accessToken || accessToken.length < 24) {
    throw new AppError("API key session token is required", 400, ERROR_CODES.VALIDATION_FAILED);
  }

  if (!apiKeys.gemini && !apiKeys.openai && !apiKeys.deepseek) {
    throw new AppError("At least one API key is required", 400, ERROR_CODES.API_KEY_REQUIRED);
  }

  req.workshop = {
    authMode: "api-key",
    visitorId,
    passwordId: null,
    remaining: undefined,
    maxUses: undefined,
    ownerTokenHash: hashAccessToken(accessToken),
  };

  req.apiKeyAuth = {
    hasGeminiKey: Boolean(apiKeys.gemini),
    hasOpenAIKey: Boolean(apiKeys.openai),
    hasDeepSeekKey: Boolean(apiKeys.deepseek),
    apiKeys,
  };

  next();
});

const apiKeyVersionAuth = asyncHandler(async (req, res, next) => {
  const visitorId = trimKey(req.body.visitorId || req.query.visitorId);
  const accessToken = trimKey(req.body.apiKeyAccessToken || req.query.apiKeyAccessToken);

  if (!visitorId) {
    throw new AppError("Visitor ID is required", 400, ERROR_CODES.VISITOR_ID_REQUIRED);
  }

  if (!accessToken || accessToken.length < 24) {
    throw new AppError("API key session token is required", 400, ERROR_CODES.VALIDATION_FAILED);
  }

  req.workshop = {
    authMode: "api-key",
    visitorId,
    passwordId: null,
    remaining: undefined,
    maxUses: undefined,
    ownerTokenHash: hashAccessToken(accessToken),
  };

  next();
});

module.exports = {
  apiKeyAuth,
  apiKeyVersionAuth,
  hashAccessToken,
};
