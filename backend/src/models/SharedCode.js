const mongoose = require("mongoose");

const sharedCodeSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      required: [true, "Share ID is required"],
      unique: true,
      uppercase: true,
      minlength: 4,
      maxlength: 4,
      match: [/^[A-Z]{4}$/, "Share ID must be exactly 4 alphabetical characters"],
    },
    code: {
      type: String,
      required: [true, "Code content is required"],
      maxlength: [500000, "Code cannot exceed 500KB"],
    },
    title: {
      type: String,
      maxlength: [100, "Title cannot exceed 100 characters"],
      default: null,
    },
    projectName: {
      type: String,
      maxlength: [50, "Project name cannot exceed 50 characters"],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for cleanup of old shares (optional future use)
sharedCodeSchema.index({ createdAt: 1 });

// Virtual for formatted response
sharedCodeSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("SharedCode", sharedCodeSchema);
