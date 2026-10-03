const mongoose = require("mongoose");
const CodeVersion = require("../models/CodeVersion");
const { AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");

function mapArtifactVersion(version, includeCode = false) {
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
    artifactType: version.artifactType || "website",
    modelProvider: version.modelProvider || null,
    modelPreference: version.modelPreference || null,
    modelId: version.modelId || null,
    modelLabel: version.modelLabel || null,
    modelShortLabel: version.modelShortLabel || null,
    modelThinking: version.modelThinking || null,
    editMode: version.editMode,
    changeScope: version.changeScope || (version.editMode === "patch" ? "localized" : "rewrite"),
    editCount: version.editCount,
    edits: version.edits || [],
    patchRetryAttempted: version.patchRetryAttempted || false,
    patchApplyMethod: version.patchApplyMethod || null,
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
}

function createArtifactVersionLineage({ VersionModel = CodeVersion, objectIds = mongoose.Types.ObjectId } = {}) {
  const getOwnerFilter = (grant) => {
    if (grant?.authMode === "api-key") {
      return {
        visitorId: grant.visitorId,
        accessMode: "api-key",
        ownerTokenHash: grant.ownerTokenHash,
      };
    }

    return {
      visitorId: grant.visitorId,
      accessMode: { $ne: "api-key" },
    };
  };

  const requireValidId = (versionId) => {
    if (!objectIds.isValid(versionId)) {
      throw new AppError("Invalid version ID", 400, ERROR_CODES.INVALID_OBJECT_ID);
    }
  };

  const resolveParent = async (parentVersionId, grant) => {
    if (!parentVersionId) return null;
    requireValidId(parentVersionId);

    const parentVersion = await VersionModel.findOne({
      _id: parentVersionId,
      ...getOwnerFilter(grant),
    });

    if (!parentVersion) {
      throw new AppError("Parent version not found", 404, ERROR_CODES.INVALID_OBJECT_ID);
    }

    return parentVersion;
  };

  const create = async ({ grant, parentVersionId, existingCode, version: versionData }) => {
    const parentVersion = await resolveParent(parentVersionId, grant);
    const created = await VersionModel.create({
      ...versionData,
      visitorId: grant.visitorId,
      passwordId: grant.passwordId || null,
      accessMode: grant.authMode === "api-key" ? "api-key" : "password",
      ownerTokenHash: grant.authMode === "api-key" ? grant.ownerTokenHash : null,
      parentVersionId: parentVersion?._id || null,
      rootVersionId: parentVersion?.rootVersionId || parentVersion?._id || null,
      manualEditsSinceParent: Boolean(parentVersion && existingCode && parentVersion.code !== existingCode),
    });

    if (!created.rootVersionId) {
      created.rootVersionId = created._id;
      await created.save();
    }

    return mapArtifactVersion(created, true);
  };

  const list = async (grant, { includeCode = true } = {}) => {
    const versions = await VersionModel.find(getOwnerFilter(grant)).sort({ createdAt: 1 }).lean();
    return versions.map((version) => mapArtifactVersion(version, includeCode));
  };

  const get = async (grant, versionId) => {
    requireValidId(versionId);
    const version = await VersionModel.findOne({ _id: versionId, ...getOwnerFilter(grant) }).lean();
    if (!version) {
      throw new AppError("Version not found", 404);
    }
    return mapArtifactVersion(version, true);
  };

  const getLineage = async (grant, versionId, { includeCode = true } = {}) => {
    requireValidId(versionId);
    const version = await VersionModel.findOne({ _id: versionId, ...getOwnerFilter(grant) }).lean();
    if (!version) {
      throw new AppError("Version not found", 404);
    }

    const rootVersionId = version.rootVersionId || version._id;
    const versions = await VersionModel.find({
      ...getOwnerFilter(grant),
      $or: [{ rootVersionId }, { _id: rootVersionId }],
    })
      .sort({ createdAt: 1 })
      .lean();

    return versions.map((item) => mapArtifactVersion(item, includeCode));
  };

  return { create, get, getLineage, getOwnerFilter, list, resolveParent };
}

module.exports = {
  artifactVersionLineage: createArtifactVersionLineage(),
  createArtifactVersionLineage,
  mapArtifactVersion,
};
