const mongoose = require("mongoose");
const CodeVersion = require("../models/CodeVersion");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const mapVersion = (version, includeCode = false) => {
  const data = {
    id: version._id.toString(),
    visitorId: version.visitorId,
    passwordId: version.passwordId?.toString() || null,
    parentVersionId: version.parentVersionId?.toString() || null,
    rootVersionId: version.rootVersionId?.toString() || null,
    prompt: version.prompt,
    message: version.message,
    projectName: version.projectName,
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

const listMyVersions = asyncHandler(async (req, res) => {
  const includeCode = req.body.includeCode !== false;
  const versions = await CodeVersion.find({ visitorId: req.workshop.visitorId }).sort({ createdAt: 1 }).lean();

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
    visitorId: req.workshop.visitorId,
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
};
