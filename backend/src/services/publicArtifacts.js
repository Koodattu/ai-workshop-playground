const PublicArtifact = require("../models/PublicArtifact");
const { artifactVersionLineage } = require("./artifactVersionLineage");
const { getBrowseSettings } = require("./browseSettings");
const { AppError } = require("../middleware/errorHandler");

function createPublicArtifacts({ ListingModel = PublicArtifact, lineage = artifactVersionLineage, getSettings = getBrowseSettings } = {}) {
  async function requireEnabled() {
    if (!(await getSettings()).enabled) throw new AppError("Browse is disabled", 403, "BROWSE_DISABLED");
  }

  async function resolveRoot(grant, versionId) {
    const version = await lineage.get(grant, versionId);
    return version.rootVersionId || version.id;
  }

  async function get(grant, versionId) {
    const rootVersionId = await resolveRoot(grant, versionId);
    const listing = await ListingModel.findOne({ rootVersionId }).lean();
    return { isPublic: Boolean(listing), shareId: listing?.shareId || null };
  }

  async function publish(grant, versionId, share, thumbnail) {
    await requireEnabled();
    const rootVersionId = await resolveRoot(grant, versionId);
    const update = { $set: { shareId: share.shareId, projectName: share.projectName || share.title, artifactType: share.artifactType, thumbnail: thumbnail || null } };
    try {
      await ListingModel.findOneAndUpdate({ rootVersionId }, update, { upsert: true, runValidators: true });
    } catch (error) {
      // Concurrent first publications race on the unique lineage index. Replace the winning slot.
      if (error.code !== 11000) throw error;
      await ListingModel.findOneAndUpdate({ rootVersionId }, update, { runValidators: true });
    }
    return { isPublic: true, shareId: share.shareId };
  }

  async function unpublish(grant, versionId) {
    const rootVersionId = await resolveRoot(grant, versionId);
    await ListingModel.deleteOne({ rootVersionId });
    return { isPublic: false, shareId: null };
  }

  return { get, publish, unpublish, requireEnabled };
}

module.exports = { createPublicArtifacts, publicArtifacts: createPublicArtifacts() };
