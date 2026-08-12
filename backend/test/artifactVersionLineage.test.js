const test = require("node:test");
const assert = require("node:assert/strict");

const { createArtifactVersionLineage } = require("../src/services/artifactVersionLineage");

test("owner filters preserve password and participant-key isolation", () => {
  const lineage = createArtifactVersionLineage({ VersionModel: {}, objectIds: { isValid: () => true } });

  assert.deepEqual(lineage.getOwnerFilter({ authMode: "password", visitorId: "visitor-1" }), {
    visitorId: "visitor-1",
    accessMode: { $ne: "api-key" },
  });
  assert.deepEqual(
    lineage.getOwnerFilter({ authMode: "api-key", visitorId: "visitor-1", ownerTokenHash: "owner-hash" }),
    { visitorId: "visitor-1", accessMode: "api-key", ownerTokenHash: "owner-hash" },
  );
});

test("creating a root version assigns itself as the lineage root", async () => {
  let createdData;
  let saved = false;
  const VersionModel = {
    create: async (data) => {
      createdData = data;
      return {
        _id: "version-1",
        ...data,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        save: async function () {
          saved = true;
        },
      };
    },
  };
  const lineage = createArtifactVersionLineage({ VersionModel, objectIds: { isValid: () => true } });

  const version = await lineage.create({
    grant: { authMode: "password", visitorId: "visitor-1", passwordId: "password-1" },
    parentVersionId: null,
    existingCode: "",
    version: { code: "<html></html>", prompt: "Create it", message: "Done", editMode: "replace_all", edits: [] },
  });

  assert.equal(createdData.parentVersionId, null);
  assert.equal(createdData.rootVersionId, null);
  assert.equal(version.rootVersionId, "version-1");
  assert.equal(saved, true);
});

test("creating a descendant preserves the root and detects manual edits", async () => {
  const parent = {
    _id: "version-1",
    rootVersionId: "root-1",
    code: "before",
  };
  let createdData;
  const VersionModel = {
    findOne: async () => parent,
    create: async (data) => {
      createdData = data;
      return {
        _id: "version-2",
        ...data,
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-02"),
        save: async () => {},
      };
    },
  };
  const lineage = createArtifactVersionLineage({ VersionModel, objectIds: { isValid: () => true } });

  await lineage.create({
    grant: { authMode: "password", visitorId: "visitor-1", passwordId: "password-1" },
    parentVersionId: "version-1",
    existingCode: "manually changed",
    version: { code: "after", prompt: "Change it", message: "Done", editMode: "patch", edits: [] },
  });

  assert.equal(createdData.parentVersionId, "version-1");
  assert.equal(createdData.rootVersionId, "root-1");
  assert.equal(createdData.manualEditsSinceParent, true);
});
