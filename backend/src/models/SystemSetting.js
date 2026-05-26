/**
 * SystemSetting Model
 * Stores small runtime/admin settings that should survive server restarts.
 */

const mongoose = require("mongoose");

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Setting key is required"],
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

systemSettingSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model("SystemSetting", systemSettingSchema);
