/**
 * Workshop Auth Middleware
 * Validates workshop passwords without consuming generation quota.
 */

const Password = require("../models/Password");
const Usage = require("../models/Usage");
const { AppError, asyncHandler } = require("./errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");

const workshopAuth = asyncHandler(async (req, res, next) => {
  const password = req.body.password || req.query.password;
  const visitorId = req.body.visitorId || req.query.visitorId;

  if (!password) {
    throw new AppError("Workshop password is required", 401, ERROR_CODES.PASSWORD_REQUIRED);
  }

  if (!visitorId) {
    throw new AppError("Visitor ID is required", 400, ERROR_CODES.VISITOR_ID_REQUIRED);
  }

  const passwordDoc = await Password.findOne({
    code: password,
    isActive: true,
  });

  if (!passwordDoc) {
    throw new AppError("Invalid workshop password", 401, ERROR_CODES.PASSWORD_INVALID);
  }

  if (passwordDoc.isExpired) {
    throw new AppError("Workshop password has expired", 401, ERROR_CODES.PASSWORD_EXPIRED);
  }

  const currentUsage = await Usage.getUsage(passwordDoc._id, visitorId);
  const remaining = Math.max(0, passwordDoc.maxUsesPerUser - currentUsage);

  req.workshop = {
    passwordId: passwordDoc._id,
    visitorId,
    remaining,
    maxUses: passwordDoc.maxUsesPerUser,
  };

  next();
});

module.exports = workshopAuth;
