const mongoose = require("mongoose");

// One gallery slot per owned lineage. Share snapshots themselves remain immutable.
const publicArtifactSchema = new mongoose.Schema({
  rootVersionId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  shareId: { type: String, required: true },
  isPublic: { type: Boolean, default: true },
  hiddenByAdmin: { type: Boolean, default: false },
  projectName: { type: String, default: null },
  artifactType: { type: String, enum: ["website", "game"], default: "website" },
  thumbnail: { type: String, default: null, maxlength: 120000, match: /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/ },
}, { timestamps: true });

publicArtifactSchema.index({ updatedAt: -1, _id: -1 });

module.exports = mongoose.model("PublicArtifact", publicArtifactSchema);
