/**
 * Admin Controller
 * Handles password management and usage statistics
 */

const Password = require("../models/Password");
const Usage = require("../models/Usage");
const config = require("../config");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

/**
 * Middleware to verify admin access
 */
const verifyAdmin = asyncHandler(async (req, res, next) => {
  const adminSecret = req.headers["x-admin-secret"];

  if (!adminSecret || adminSecret !== config.adminSecret) {
    throw new AppError("Unauthorized: Invalid admin credentials", 401);
  }

  next();
});

/**
 * Verify admin credentials endpoint
 * Returns success if the admin secret is valid
 */
const verifyAdminCredentials = asyncHandler(async (req, res) => {
  // If we reach here, verifyAdmin middleware has already validated the credentials
  res.json({
    message: "Admin credentials verified successfully",
    authenticated: true,
  });
});

/**
 * Create a new workshop password
 */
const createPassword = asyncHandler(async (req, res) => {
  const { code, expiresAt, maxUsesPerUser, isActive } = req.body;

  const password = await Password.create({
    code,
    expiresAt: new Date(expiresAt),
    maxUsesPerUser: maxUsesPerUser || 20,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    message: "Password created successfully",
    password: {
      id: password._id,
      code: password.code,
      expiresAt: password.expiresAt,
      maxUsesPerUser: password.maxUsesPerUser,
      isActive: password.isActive,
    },
  });
});

/**
 * List all passwords with basic stats
 */
const listPasswords = asyncHandler(async (req, res) => {
  const passwords = await Password.find().select("-__v").sort({ createdAt: -1 }).lean();

  // Get usage counts for each password
  const passwordsWithStats = await Promise.all(
    passwords.map(async (password) => {
      const usageStats = await Usage.aggregate([
        { $match: { passwordId: password._id } },
        {
          $group: {
            _id: null,
            totalUses: { $sum: "$useCount" },
            uniqueUsers: { $sum: 1 },
          },
        },
      ]);

      const stats = usageStats[0] || { totalUses: 0, uniqueUsers: 0 };

      return {
        ...password,
        isExpired: new Date() > new Date(password.expiresAt),
        stats: {
          totalUses: stats.totalUses,
          uniqueUsers: stats.uniqueUsers,
        },
      };
    }),
  );

  res.json({
    count: passwordsWithStats.length,
    passwords: passwordsWithStats,
  });
});

/**
 * Get detailed usage statistics
 */
const getUsageStats = asyncHandler(async (req, res) => {
  const { passwordId } = req.query;

  // Build match condition
  const matchCondition = passwordId ? { passwordId: new (require("mongoose").Types.ObjectId)(passwordId) } : {};

  // Aggregate usage statistics
  const stats = await Usage.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: "$passwordId",
        totalUses: { $sum: "$useCount" },
        uniqueUsers: { $sum: 1 },
        avgUsesPerUser: { $avg: "$useCount" },
        maxUsesPerUser: { $max: "$useCount" },
      },
    },
    {
      $lookup: {
        from: "passwords",
        localField: "_id",
        foreignField: "_id",
        as: "password",
      },
    },
    { $unwind: "$password" },
    {
      $project: {
        passwordCode: "$password.code",
        passwordActive: "$password.isActive",
        passwordExpires: "$password.expiresAt",
        totalUses: 1,
        uniqueUsers: 1,
        avgUsesPerUser: { $round: ["$avgUsesPerUser", 2] },
        maxUsesPerUser: 1,
      },
    },
    { $sort: { totalUses: -1 } },
  ]);

  // Overall totals
  const totals = await Usage.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalUses: { $sum: "$useCount" },
        uniqueUsers: { $sum: 1 },
      },
    },
  ]);

  const overall = totals[0] || { totalUses: 0, uniqueUsers: 0 };

  res.json({
    overall: {
      totalUses: overall.totalUses,
      uniqueUsers: overall.uniqueUsers,
    },
    byPassword: stats,
  });
});

/**
 * Update a password
 */
const updatePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expiresAt, maxUsesPerUser, isActive } = req.body;

  const updateData = {};
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);
  if (maxUsesPerUser !== undefined) updateData.maxUsesPerUser = maxUsesPerUser;
  if (isActive !== undefined) updateData.isActive = isActive;

  const password = await Password.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!password) {
    throw new AppError("Password not found", 404);
  }

  res.json({
    message: "Password updated successfully",
    password,
  });
});

/**
 * Delete a password and its usage records
 */
const deletePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const password = await Password.findByIdAndDelete(id);

  if (!password) {
    throw new AppError("Password not found", 404);
  }

  // Clean up associated usage records
  await Usage.deleteMany({ passwordId: id });

  res.json({
    message: "Password and associated usage records deleted successfully",
  });
});

module.exports = {
  verifyAdmin,
  verifyAdminCredentials,
  createPassword,
  listPasswords,
  getUsageStats,
  updatePassword,
  deletePassword,
};
