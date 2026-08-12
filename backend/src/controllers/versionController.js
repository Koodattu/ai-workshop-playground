const { asyncHandler } = require("../middleware/errorHandler");
const { artifactVersionLineage, mapArtifactVersion } = require("../services/artifactVersionLineage");

const listMyVersions = asyncHandler(async (req, res) => {
  const includeCode = req.body.includeCode !== false;
  const versions = await artifactVersionLineage.list(req.workshopAccessGrant, { includeCode });

  res.json({
    count: versions.length,
    versions,
  });
});

const getMyVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.params;

  res.json({
    version: await artifactVersionLineage.get(req.workshopAccessGrant, versionId),
  });
});

const getMyVersionLineage = asyncHandler(async (req, res) => {
  const versions = await artifactVersionLineage.getLineage(req.workshopAccessGrant, req.params.versionId, {
    includeCode: req.body.includeCode !== false,
  });

  res.json({ count: versions.length, versions });
});

module.exports = {
  listMyVersions,
  getMyVersion,
  getMyVersionLineage,
  mapVersion: mapArtifactVersion,
  getMyVersionFilter: artifactVersionLineage.getOwnerFilter,
};
