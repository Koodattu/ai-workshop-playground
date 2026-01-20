/**
 * Workshop Guard Middleware
 * Validates workshop passwords and enforces per-machine rate limits
 */

const Password = require("../models/Password");
const Usage = require("../models/Usage");
const { AppError, asyncHandler } = require("./errorHandler");

/**
 * Middleware to validate workshop access
 * Checks password validity and usage limits
 */
const workshopGuard = asyncHandler(async (req, res, next) => {
  const { password, visitorId } = req.body;

  // Validate required fields
  if (!password) {
    throw new AppError("Workshop password is required", 401);
  }

  if (!visitorId) {
    throw new AppError("Visitor ID is required", 400);
  }

  // Find password in database
  const passwordDoc = await Password.findOne({
    code: password,
    isActive: true,
  });

  if (!passwordDoc) {
    throw new AppError("Invalid workshop password", 401);
  }

  // Check if password is expired
  if (passwordDoc.isExpired) {
    throw new AppError("Workshop password has expired", 401);
  }

  // Check current usage before incrementing
  const currentUsage = await Usage.getUsage(passwordDoc._id, visitorId);

  if (currentUsage >= passwordDoc.maxUsesPerUser) {
    throw new AppError(`Rate limit exceeded. Maximum ${passwordDoc.maxUsesPerUser} requests allowed per session.`, 429);
  }

  // Increment usage count
  const { remaining } = await Usage.incrementUsage(passwordDoc._id, visitorId, passwordDoc.maxUsesPerUser);

  // Attach password info to request for downstream use
  req.workshop = {
    passwordId: passwordDoc._id,
    visitorId,
    remaining,
    maxUses: passwordDoc.maxUsesPerUser,
  };

  // Add rate limit headers
  res.set("X-RateLimit-Limit", passwordDoc.maxUsesPerUser.toString());
  res.set("X-RateLimit-Remaining", remaining.toString());

  next();
});

module.exports = workshopGuard;
