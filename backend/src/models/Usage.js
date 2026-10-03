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

// Atomically consumes one generation use only when quota remains.
usageSchema.statics.consumeWithinLimit = async function (passwordId, visitorId, maxUses) {
  const filter = {
    passwordId,
    visitorId,
    $or: [{ useCount: { $lt: maxUses } }, { useCount: { $exists: false } }],
  };
  const update = {
    $inc: { useCount: 1 },
    $setOnInsert: { passwordId, visitorId },
  };

  try {
    const usage = await this.findOneAndUpdate(filter, update, { returnDocument: "after", upsert: true, setDefaultsOnInsert: true });

    if (!usage) return null;

    return {
      usage,
      remaining: Math.max(0, maxUses - usage.useCount),
    };
  } catch (error) {
    if (error?.code === 11000) {
      // A concurrent first use may win the upsert. Retry against that record
      // without upserting so remaining quota can still be consumed.
      const usage = await this.findOneAndUpdate(filter, { $inc: { useCount: 1 } }, { returnDocument: "after" });
      if (!usage) return null;
      return {
        usage,
        remaining: Math.max(0, maxUses - usage.useCount),
      };
    }
    throw error;
  }
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

  const usage = await this.findOneAndUpdate({ passwordId, visitorId }, updateOps, { returnDocument: "after", upsert: true, setDefaultsOnInsert: true });

  return usage;
};

module.exports = mongoose.model("Usage", usageSchema);
