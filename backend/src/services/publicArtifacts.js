const PublicArtifact = require("../models/PublicArtifact");
const { artifactVersionLineage } = require("./artifactVersionLineage");
const { getBrowseSettings } = require("./browseSettings");
const { AppError } = require("../middleware/errorHandler");

function createPublicArtifacts({ ListingModel = PublicArtifact, lineage = artifactVersionLineage, getSettings = getBrowseSettings } = {}) {
  function status(listing) {
    return {
      isPublic: Boolean(listing && listing.isPublic !== false),
      shareId: listing && listing.isPublic !== false ? listing.shareId : null,
      ...(listing?.hiddenByAdmin ? { hiddenByAdmin: true } : {}),
    };
  }

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
    return status(listing);
  }

  async function publish(grant, versionId, share, thumbnail) {
    await requireEnabled();
    const rootVersionId = await resolveRoot(grant, versionId);
    const update = { $set: { isPublic: true, shareId: share.shareId, projectName: share.projectName || share.title, artifactType: share.artifactType, thumbnail: thumbnail || null } };
    let listing;
    try {
      listing = await ListingModel.findOneAndUpdate({ rootVersionId }, update, { upsert: true, runValidators: true, returnDocument: "after" });
    } catch (error) {
      // Concurrent first publications race on the unique lineage index. Replace the winning slot.
      if (error.code !== 11000) throw error;
      listing = await ListingModel.findOneAndUpdate({ rootVersionId }, update, { runValidators: true, returnDocument: "after" });
    }
    return status(listing);
  }

  async function unpublish(grant, versionId) {
    const rootVersionId = await resolveRoot(grant, versionId);
    // Retain the slot so unpublishing and republishing cannot erase moderation.
    const listing = await ListingModel.findOneAndUpdate({ rootVersionId }, { $set: { isPublic: false } }, { returnDocument: "after" });
    return status(listing);
  }

  return { get, publish, unpublish, requireEnabled };
}

module.exports = { createPublicArtifacts, publicArtifacts: createPublicArtifacts() };
