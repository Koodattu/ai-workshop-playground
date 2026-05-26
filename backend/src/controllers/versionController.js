const mongoose = require("mongoose");
const CodeVersion = require("../models/CodeVersion");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const mapVersion = (version, includeCode = false) => {
  const data = {
    id: version._id.toString(),
    visitorId: version.visitorId,
    passwordId: version.passwordId?.toString() || null,
    accessMode: version.accessMode || "password",
    parentVersionId: version.parentVersionId?.toString() || null,
    rootVersionId: version.rootVersionId?.toString() || null,
    prompt: version.prompt,
    message: version.message,
    projectName: version.projectName,
    modelProvider: version.modelProvider || null,
    modelPreference: version.modelPreference || null,
    modelId: version.modelId || null,
    modelLabel: version.modelLabel || null,
    modelShortLabel: version.modelShortLabel || null,
    modelThinking: version.modelThinking || null,
    editMode: version.editMode,
    editCount: version.editCount,
    edits: version.edits || [],
    manualEditsSinceParent: version.manualEditsSinceParent,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };

  if (includeCode) {
    data.code = version.code;
  } else {
    data.codePreview = version.code.slice(0, 160);
    data.codeLength = version.code.length;
  }

  return data;
};

const getMyVersionFilter = (workshop) => {
  if (workshop?.authMode === "api-key") {
    return {
      visitorId: workshop.visitorId,
      accessMode: "api-key",
      ownerTokenHash: workshop.ownerTokenHash,
    };
  }

  return {
    visitorId: workshop.visitorId,
    accessMode: { $ne: "api-key" },
  };
};

const listMyVersions = asyncHandler(async (req, res) => {
  const includeCode = req.body.includeCode !== false;
  const versions = await CodeVersion.find(getMyVersionFilter(req.workshop)).sort({ createdAt: 1 }).lean();

  res.json({
    count: versions.length,
    versions: versions.map((version) => mapVersion(version, includeCode)),
  });
});

const getMyVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(versionId)) {
    throw new AppError("Invalid version ID", 400);
  }

  const version = await CodeVersion.findOne({
    _id: versionId,
    ...getMyVersionFilter(req.workshop),
  }).lean();

  if (!version) {
    throw new AppError("Version not found", 404);
  }

  res.json({
    version: mapVersion(version, true),
  });
});

module.exports = {
  listMyVersions,
  getMyVersion,
  mapVersion,
  getMyVersionFilter,
};
