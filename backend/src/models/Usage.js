/**
 * Usage Model
 * Tracks per-machine usage for rate limiting
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
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient lookups and uniqueness
usageSchema.index({ passwordId: 1, visitorId: 1 }, { unique: true });

// Static method to increment usage and check limit
usageSchema.statics.incrementUsage = async function (passwordId, visitorId, maxUses) {
  const usage = await this.findOneAndUpdate({ passwordId, visitorId }, { $inc: { useCount: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });

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

module.exports = mongoose.model("Usage", usageSchema);
