/**
 * Admin Controller
 * Handles password management and usage statistics
 */

const mongoose = require("mongoose");
const Password = require("../models/Password");
const Usage = require("../models/Usage");
const RequestLog = require("../models/RequestLog");
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

  // Clean up associated request logs
  await RequestLog.deleteMany({ passwordId: id });

  res.json({
    message: "Password and associated usage records deleted successfully",
  });
});

/**
 * Get overall system-wide statistics
 */
const getSystemStats = asyncHandler(async (req, res) => {
  // Get current date boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate overall statistics from RequestLog
  const overallStats = await RequestLog.aggregate([
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalPromptTokens: { $sum: "$promptTokens" },
        totalCandidatesTokens: { $sum: "$candidatesTokens" },
        totalThoughtsTokens: { $sum: "$thoughtsTokens" },
        totalTokens: { $sum: "$totalTokens" },
        totalEstimatedCost: { $sum: "$estimatedCost" },
        uniqueVisitors: { $addToSet: "$visitorId" },
      },
    },
    {
      $project: {
        _id: 0,
        totalRequests: 1,
        totalPromptTokens: 1,
        totalCandidatesTokens: 1,
        totalThoughtsTokens: 1,
        totalTokens: 1,
        totalEstimatedCost: { $round: ["$totalEstimatedCost", 6] },
        uniqueUsers: { $size: "$uniqueVisitors" },
        avgTokensPerRequest: {
          $cond: [{ $eq: ["$totalRequests", 0] }, 0, { $round: [{ $divide: ["$totalTokens", "$totalRequests"] }, 2] }],
        },
      },
    },
  ]);

  // Get time-based request counts
  const [requestsToday, requestsThisWeek, requestsThisMonth] = await Promise.all([
    RequestLog.countDocuments({ createdAt: { $gte: startOfToday } }),
    RequestLog.countDocuments({ createdAt: { $gte: startOfWeek } }),
    RequestLog.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);

  // Get active passwords count
  const activePasswordsCount = await Password.countDocuments({
    isActive: true,
    expiresAt: { $gt: now },
  });

  const stats = overallStats[0] || {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCandidatesTokens: 0,
    totalThoughtsTokens: 0,
    totalTokens: 0,
    totalEstimatedCost: 0,
    uniqueUsers: 0,
    avgTokensPerRequest: 0,
  };

  res.json({
    ...stats,
    requestsToday,
    requestsThisWeek,
    requestsThisMonth,
    activePasswords: activePasswordsCount,
  });
});

/**
 * Get detailed stats for a specific password
 */
const getPasswordDetailedStats = asyncHandler(async (req, res) => {
  const { passwordId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(passwordId)) {
    throw new AppError("Invalid password ID", 400);
  }

  const passwordIdObj = new mongoose.Types.ObjectId(passwordId);

  // Get password info
  const password = await Password.findById(passwordIdObj).lean();

  if (!password) {
    throw new AppError("Password not found", 404);
  }

  // Get aggregated stats for this password
  const requestStats = await RequestLog.aggregate([
    { $match: { passwordId: passwordIdObj } },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalPromptTokens: { $sum: "$promptTokens" },
        totalCandidatesTokens: { $sum: "$candidatesTokens" },
        totalThoughtsTokens: { $sum: "$thoughtsTokens" },
        totalTokens: { $sum: "$totalTokens" },
        totalEstimatedCost: { $sum: "$estimatedCost" },
      },
    },
  ]);

  // Get unique visitors with their individual stats
  const visitorStats = await Usage.find({ passwordId: passwordIdObj }).select("visitorId useCount totalTokens estimatedCost updatedAt").sort({ totalTokens: -1 }).lean();

  const stats = requestStats[0] || {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCandidatesTokens: 0,
    totalThoughtsTokens: 0,
    totalTokens: 0,
    totalEstimatedCost: 0,
  };

  res.json({
    password: {
      id: password._id,
      code: password.code,
      isActive: password.isActive,
      expiresAt: password.expiresAt,
      isExpired: new Date() > new Date(password.expiresAt),
      maxUsesPerUser: password.maxUsesPerUser,
    },
    stats: {
      totalRequests: stats.totalRequests,
      tokens: {
        prompt: stats.totalPromptTokens,
        candidates: stats.totalCandidatesTokens,
        thoughts: stats.totalThoughtsTokens,
        total: stats.totalTokens,
      },
      estimatedCost: Math.round(stats.totalEstimatedCost * 1000000) / 1000000,
    },
    users: visitorStats.map((v) => ({
      visitorId: v.visitorId,
      requestCount: v.useCount,
      totalTokens: v.totalTokens,
      estimatedCost: Math.round(v.estimatedCost * 1000000) / 1000000,
      lastUsed: v.updatedAt,
    })),
    uniqueUsersCount: visitorStats.length,
  });
});

/**
 * Get paginated list of users for a specific password
 */
const getUsersForPassword = asyncHandler(async (req, res) => {
  const { passwordId } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  if (!mongoose.Types.ObjectId.isValid(passwordId)) {
    throw new AppError("Invalid password ID", 400);
  }

  const passwordIdObj = new mongoose.Types.ObjectId(passwordId);

  // Verify password exists
  const password = await Password.findById(passwordIdObj).select("code").lean();

  if (!password) {
    throw new AppError("Password not found", 404);
  }

  const skip = (page - 1) * limit;

  // Get total count for pagination
  const totalUsers = await Usage.countDocuments({ passwordId: passwordIdObj });

  // Get paginated users
  const users = await Usage.find({ passwordId: passwordIdObj })
    .select("visitorId useCount totalPromptTokens totalCandidatesTokens totalThoughtsTokens totalTokens estimatedCost createdAt updatedAt")
    .sort({ totalTokens: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPages = Math.ceil(totalUsers / limit);

  res.json({
    passwordCode: password.code,
    users: users.map((u) => ({
      visitorId: u.visitorId,
      requestCount: u.useCount,
      tokens: {
        prompt: u.totalPromptTokens,
        candidates: u.totalCandidatesTokens,
        thoughts: u.totalThoughtsTokens,
        total: u.totalTokens,
      },
      estimatedCost: Math.round(u.estimatedCost * 1000000) / 1000000,
      firstUsed: u.createdAt,
      lastUsed: u.updatedAt,
    })),
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * Get recent requests log
 */
const getRecentRequests = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const { passwordId } = req.query;

  const matchCondition = {};

  if (passwordId) {
    if (!mongoose.Types.ObjectId.isValid(passwordId)) {
      throw new AppError("Invalid password ID", 400);
    }
    matchCondition.passwordId = new mongoose.Types.ObjectId(passwordId);
  }

  // Get recent requests with password code included
  const requests = await RequestLog.aggregate([
    { $match: matchCondition },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "passwords",
        localField: "passwordId",
        foreignField: "_id",
        as: "password",
      },
    },
    { $unwind: { path: "$password", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        visitorId: 1,
        passwordCode: { $ifNull: ["$password.code", "Unknown"] },
        promptTokens: 1,
        candidatesTokens: 1,
        thoughtsTokens: 1,
        cachedTokens: 1,
        totalTokens: 1,
        estimatedCost: 1,
        model: 1,
        generationType: 1,
        createdAt: 1,
      },
    },
  ]);

  res.json({
    count: requests.length,
    requests,
  });
});

/**
 * Get token usage over time for charts
 */
const getTokenTimeSeries = asyncHandler(async (req, res) => {
  const { period = "week", passwordId } = req.query;

  const validPeriods = ["day", "week", "month"];
  if (!validPeriods.includes(period)) {
    throw new AppError("Invalid period. Must be 'day', 'week', or 'month'", 400);
  }

  const matchCondition = {};

  if (passwordId) {
    if (!mongoose.Types.ObjectId.isValid(passwordId)) {
      throw new AppError("Invalid password ID", 400);
    }
    matchCondition.passwordId = new mongoose.Types.ObjectId(passwordId);
  }

  // Calculate date range and grouping based on period
  const now = new Date();
  let startDate;
  let dateFormat;
  let bucketLabel;

  switch (period) {
    case "day":
      // Last 24 hours, hourly buckets
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
      bucketLabel = "hourly";
      break;
    case "week":
      // Last 7 days, daily buckets
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      bucketLabel = "daily";
      break;
    case "month":
      // Last 30 days, daily buckets
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFormat = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      bucketLabel = "daily";
      break;
  }

  matchCondition.createdAt = { $gte: startDate };

  const timeSeries = await RequestLog.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: dateFormat,
        requests: { $sum: 1 },
        promptTokens: { $sum: "$promptTokens" },
        candidatesTokens: { $sum: "$candidatesTokens" },
        thoughtsTokens: { $sum: "$thoughtsTokens" },
        totalTokens: { $sum: "$totalTokens" },
        estimatedCost: { $sum: "$estimatedCost" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } },
    {
      $project: {
        _id: 0,
        timestamp: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
            hour: { $ifNull: ["$_id.hour", 0] },
          },
        },
        requests: 1,
        promptTokens: 1,
        candidatesTokens: 1,
        thoughtsTokens: 1,
        totalTokens: 1,
        estimatedCost: { $round: ["$estimatedCost", 6] },
      },
    },
  ]);

  res.json({
    period,
    bucketLabel,
    startDate,
    endDate: now,
    dataPoints: timeSeries.length,
    data: timeSeries,
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
  getSystemStats,
  getPasswordDetailedStats,
  getUsersForPassword,
  getRecentRequests,
  getTokenTimeSeries,
};
