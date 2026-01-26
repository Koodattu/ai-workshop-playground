/**
 * RequestLog Model
 * Stores individual AI generation request logs for detailed analytics
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const requestLogSchema = new mongoose.Schema(
  {
    passwordId: {
      type: Schema.Types.ObjectId,
      ref: "Password",
      required: [true, "Password ID is required"],
    },
    visitorId: {
      type: String,
      required: [true, "Visitor ID is required"],
      trim: true,
    },
    promptTokens: {
      type: Number,
      required: [true, "Prompt tokens is required"],
      min: [0, "Prompt tokens cannot be negative"],
    },
    candidatesTokens: {
      type: Number,
      required: [true, "Candidates tokens is required"],
      min: [0, "Candidates tokens cannot be negative"],
    },
    thoughtsTokens: {
      type: Number,
      default: 0,
      min: [0, "Thoughts tokens cannot be negative"],
    },
    cachedTokens: {
      type: Number,
      default: 0,
      min: [0, "Cached tokens cannot be negative"],
    },
    totalTokens: {
      type: Number,
      required: [true, "Total tokens is required"],
      min: [0, "Total tokens cannot be negative"],
    },
    estimatedCost: {
      type: Number,
      required: [true, "Estimated cost is required"],
      min: [0, "Estimated cost cannot be negative"],
    },
    model: {
      type: String,
      required: [true, "Model name is required"],
      trim: true,
    },
    generationType: {
      type: String,
      required: [true, "Generation type is required"],
      trim: true,
    },
    mode: {
      type: String,
      enum: ["edit", "ask"],
      default: "edit",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
requestLogSchema.index({ passwordId: 1 }); // Per-password stats
requestLogSchema.index({ visitorId: 1 }); // Per-user stats
requestLogSchema.index({ createdAt: -1 }); // Time-series queries (descending for recent first)

// Compound index for password + time queries
requestLogSchema.index({ passwordId: 1, createdAt: -1 });

// Static method to create a new request log
requestLogSchema.statics.logRequest = async function (logData) {
  const requestLog = new this(logData);
  await requestLog.save();
  return requestLog;
};

// Static method to get stats for a password
requestLogSchema.statics.getPasswordStats = async function (passwordId, startDate = null, endDate = null) {
  const match = { passwordId };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalPromptTokens: { $sum: "$promptTokens" },
        totalCandidatesTokens: { $sum: "$candidatesTokens" },
        totalThoughtsTokens: { $sum: "$thoughtsTokens" },
        totalCachedTokens: { $sum: "$cachedTokens" },
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
        totalCachedTokens: 1,
        totalTokens: 1,
        totalEstimatedCost: 1,
        uniqueVisitorCount: { $size: "$uniqueVisitors" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCandidatesTokens: 0,
      totalThoughtsTokens: 0,
      totalCachedTokens: 0,
      totalTokens: 0,
      totalEstimatedCost: 0,
      uniqueVisitorCount: 0,
    }
  );
};

// Static method to get recent requests
requestLogSchema.statics.getRecentRequests = async function (limit = 50, passwordId = null) {
  const query = passwordId ? { passwordId } : {};
  return this.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

module.exports = mongoose.model("RequestLog", requestLogSchema);
