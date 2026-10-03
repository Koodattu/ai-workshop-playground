const crypto = require("crypto");
const Password = require("../models/Password");
const Usage = require("../models/Usage");
const { AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");

const PROVIDERS = ["gemini", "openai", "deepseek"];

const trim = (value) => (typeof value === "string" ? value.trim() : "");
const hashAccessToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function createProviderAuthorization(apiKeys = {}) {
  const keys = Object.fromEntries(PROVIDERS.map((provider) => [provider, trim(apiKeys[provider])]));

  return Object.freeze({
    has(provider) {
      return Boolean(keys[provider]);
    },
    get(provider) {
      return keys[provider] || null;
    },
  });
}

function createWorkshopAccess({ PasswordModel = Password, UsageModel = Usage } = {}) {
  const requireVisitorId = (credentials) => {
    const visitorId = trim(credentials.visitorId);
    if (!visitorId) {
      throw new AppError("Visitor ID is required", 400, ERROR_CODES.VISITOR_ID_REQUIRED);
    }
    return visitorId;
  };

  const resolvePassword = async (credentials) => {
    const password = trim(credentials.password);
    const visitorId = requireVisitorId(credentials);

    if (!password) {
      throw new AppError("Workshop password is required", 401, ERROR_CODES.PASSWORD_REQUIRED);
    }

    const passwordDoc = await PasswordModel.findOne({ code: password, isActive: true });
    if (!passwordDoc) {
      throw new AppError("Invalid workshop password", 401, ERROR_CODES.PASSWORD_INVALID);
    }
    if (passwordDoc.isExpired) {
      throw new AppError("Workshop password has expired", 401, ERROR_CODES.PASSWORD_EXPIRED);
    }

    return { passwordDoc, visitorId };
  };

  const resolveParticipantKeys = (credentials, requireKeys) => {
    const visitorId = requireVisitorId(credentials);
    const accessToken = trim(credentials.accessToken);

    if (!accessToken || accessToken.length < 24) {
      throw new AppError("API key session token is required", 400, ERROR_CODES.VALIDATION_FAILED);
    }

    const providerAuthorization = createProviderAuthorization(credentials.apiKeys);
    if (requireKeys && !PROVIDERS.some((provider) => providerAuthorization.has(provider))) {
      throw new AppError("At least one API key is required", 400, ERROR_CODES.API_KEY_REQUIRED);
    }

    return {
      authMode: "api-key",
      visitorId,
      passwordId: null,
      remaining: undefined,
      maxUses: undefined,
      ownerTokenHash: hashAccessToken(accessToken),
      providerAuthorization,
    };
  };

  const inspect = async (credentials) => {
    if (credentials.authMode === "api-key") {
      return resolveParticipantKeys(credentials, false);
    }

    const { passwordDoc, visitorId } = await resolvePassword(credentials);
    const currentUsage = await UsageModel.getUsage(passwordDoc._id, visitorId);

    return {
      authMode: "password",
      passwordId: passwordDoc._id,
      visitorId,
      remaining: Math.max(0, passwordDoc.maxUsesPerUser - currentUsage),
      maxUses: passwordDoc.maxUsesPerUser,
      ownerTokenHash: null,
      providerAuthorization: null,
    };
  };

  const grantForGeneration = async (credentials) => {
    if (credentials.authMode === "api-key") {
      return resolveParticipantKeys(credentials, true);
    }

    const { passwordDoc, visitorId } = await resolvePassword(credentials);
    const consumed = await UsageModel.consumeWithinLimit(passwordDoc._id, visitorId, passwordDoc.maxUsesPerUser);

    if (!consumed) {
      throw new AppError(
        `Rate limit exceeded. Maximum ${passwordDoc.maxUsesPerUser} requests allowed per session.`,
        429,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
      );
    }

    return {
      authMode: "password",
      passwordId: passwordDoc._id,
      visitorId,
      remaining: consumed.remaining,
      maxUses: passwordDoc.maxUsesPerUser,
      ownerTokenHash: null,
      providerAuthorization: null,
    };
  };

  return { inspect, grantForGeneration };
}

module.exports = {
  createProviderAuthorization,
  createWorkshopAccess,
  hashAccessToken,
  workshopAccess: createWorkshopAccess(),
};
