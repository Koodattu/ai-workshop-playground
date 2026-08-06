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
    accessMode: {
      type: String,
      enum: ["password", "api-key"],
      default: "password",
      index: true,
    },
    ownerTokenHash: {
      type: String,
      default: null,
      maxlength: [128, "Owner token hash cannot exceed 128 characters"],
      index: true,
      select: false,
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
    artifactType: {
      type: String,
      enum: ["website", "game"],
      default: "website",
    },
    modelProvider: {
      type: String,
      enum: ["gemini", "openai", "deepseek", null],
      default: null,
    },
    modelPreference: {
      type: String,
      default: null,
      maxlength: [50, "Model preference cannot exceed 50 characters"],
    },
    modelId: {
      type: String,
      default: null,
      maxlength: [100, "Model ID cannot exceed 100 characters"],
    },
    modelLabel: {
      type: String,
      default: null,
      maxlength: [100, "Model label cannot exceed 100 characters"],
    },
    modelShortLabel: {
      type: String,
      default: null,
      maxlength: [30, "Model short label cannot exceed 30 characters"],
    },
    modelThinking: {
      type: String,
      default: null,
      maxlength: [30, "Model thinking setting cannot exceed 30 characters"],
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
    edits: {
      type: [
        {
          oldText: {
            type: String,
            required: true,
            maxlength: [500000, "Patch oldText cannot exceed 500KB"],
          },
          newText: {
            type: String,
            default: "",
            maxlength: [500000, "Patch newText cannot exceed 500KB"],
          },
        },
      ],
      default: [],
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
codeVersionSchema.index({ visitorId: 1, accessMode: 1, ownerTokenHash: 1, createdAt: -1 });
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
