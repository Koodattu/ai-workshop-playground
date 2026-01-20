/**
 * Password Model
 * Stores workshop access passwords with expiration and usage limits
 */

const mongoose = require("mongoose");

const passwordSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      required: [true, "Password code is required"],
      trim: true,
      minlength: [4, "Password code must be at least 4 characters"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    maxUsesPerUser: {
      type: Number,
      default: 20,
      min: [1, "Max uses per user must be at least 1"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient lookups
passwordSchema.index({ code: 1, isActive: 1 });

// Virtual to check if password is expired
passwordSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Method to check if password is valid for use
passwordSchema.methods.isValid = function () {
  return this.isActive && !this.isExpired;
};

// Ensure virtuals are included in JSON output
passwordSchema.set("toJSON", { virtuals: true });
passwordSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Password", passwordSchema);
