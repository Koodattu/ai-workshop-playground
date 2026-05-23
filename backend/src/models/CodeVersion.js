const mongoose = require("mongoose");

const codeVersionSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: [true, "Visitor ID is required"],
      index: true,
    },
    passwordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Password",
      default: null,
      index: true,
    },
    parentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodeVersion",
      default: null,
      index: true,
    },
    rootVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodeVersion",
      default: null,
      index: true,
    },
    code: {
      type: String,
      required: [true, "Code content is required"],
      maxlength: [500000, "Code cannot exceed 500KB"],
    },
    prompt: {
      type: String,
      maxlength: [10000, "Prompt cannot exceed 10000 characters"],
      default: "",
    },
    message: {
      type: String,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
      default: "",
    },
    projectName: {
      type: String,
      maxlength: [50, "Project name cannot exceed 50 characters"],
      default: null,
    },
    editMode: {
      type: String,
      enum: ["replace_all", "patch"],
      default: "replace_all",
    },
    editCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualEditsSinceParent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

codeVersionSchema.index({ visitorId: 1, createdAt: -1 });
codeVersionSchema.index({ rootVersionId: 1, createdAt: 1 });

codeVersionSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("CodeVersion", codeVersionSchema);
