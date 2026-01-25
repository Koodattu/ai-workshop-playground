/**
 * Usage Model
 * Tracks per-machine usage for rate limiting and aggregate token usage
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const usageSchema = new mongoose.Schema(
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
    useCount: {
      type: Number,
      default: 0,
      min: [0, "Use count cannot be negative"],
    },
    // Aggregate token tracking
    totalPromptTokens: {
      type: Number,
      default: 0,
      min: [0, "Total prompt tokens cannot be negative"],
    },
    totalCandidatesTokens: {
      type: Number,
      default: 0,
      min: [0, "Total candidates tokens cannot be negative"],
    },
    totalThoughtsTokens: {
      type: Number,
      default: 0,
      min: [0, "Total thoughts tokens cannot be negative"],
    },
    totalTokens: {
      type: Number,
      default: 0,
      min: [0, "Total tokens cannot be negative"],
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: [0, "Estimated cost cannot be negative"],
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient lookups and uniqueness
usageSchema.index({ passwordId: 1, visitorId: 1 }, { unique: true });

// Static method to increment usage and check limit, optionally with token data
usageSchema.statics.incrementUsage = async function (passwordId, visitorId, maxUses, tokenData = null) {
  const updateOps = { $inc: { useCount: 1 } };

  // Add token tracking if provided
  if (tokenData) {
    if (tokenData.promptTokens) {
      updateOps.$inc.totalPromptTokens = tokenData.promptTokens;
    }
    if (tokenData.candidatesTokens) {
      updateOps.$inc.totalCandidatesTokens = tokenData.candidatesTokens;
    }
    if (tokenData.thoughtsTokens) {
      updateOps.$inc.totalThoughtsTokens = tokenData.thoughtsTokens;
    }
    if (tokenData.totalTokens) {
      updateOps.$inc.totalTokens = tokenData.totalTokens;
    }
    if (tokenData.estimatedCost) {
      updateOps.$inc.estimatedCost = tokenData.estimatedCost;
    }
  }

  const usage = await this.findOneAndUpdate({ passwordId, visitorId }, updateOps, { new: true, upsert: true, setDefaultsOnInsert: true });

  return {
    usage,
    withinLimit: usage.useCount <= maxUses,
    remaining: Math.max(0, maxUses - usage.useCount),
  };
};

// Static method to get usage without incrementing
usageSchema.statics.getUsage = async function (passwordId, visitorId) {
  const usage = await this.findOne({ passwordId, visitorId });
  return usage?.useCount || 0;
};

// Static method to track token usage without incrementing use count
usageSchema.statics.trackTokenUsage = async function (passwordId, visitorId, tokenData) {
  const updateOps = { $inc: {} };

  if (tokenData.promptTokens) {
    updateOps.$inc.totalPromptTokens = tokenData.promptTokens;
  }
  if (tokenData.candidatesTokens) {
    updateOps.$inc.totalCandidatesTokens = tokenData.candidatesTokens;
  }
  if (tokenData.thoughtsTokens) {
    updateOps.$inc.totalThoughtsTokens = tokenData.thoughtsTokens;
  }
  if (tokenData.totalTokens) {
    updateOps.$inc.totalTokens = tokenData.totalTokens;
  }
  if (tokenData.estimatedCost) {
    updateOps.$inc.estimatedCost = tokenData.estimatedCost;
  }

  const usage = await this.findOneAndUpdate({ passwordId, visitorId }, updateOps, { new: true, upsert: true, setDefaultsOnInsert: true });

  return usage;
};

module.exports = mongoose.model("Usage", usageSchema);
