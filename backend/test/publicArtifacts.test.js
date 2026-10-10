const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublicArtifacts } = require("../src/services/publicArtifacts");
const PublicArtifact = require("../src/models/PublicArtifact");

function fixture() {
  const listings = new Map();
  let enabled = true;
  const service = createPublicArtifacts({
    getSettings: async () => ({ enabled }),
    lineage: { get: async (grant, versionId) => {
      if (grant.visitorId !== "owner") throw new Error("Version not found");
      return { id: versionId, rootVersionId: versionId === "separate" ? "separate" : "root" };
    } },
    ListingModel: {
      findOne: ({ rootVersionId }) => ({ lean: async () => listings.get(rootVersionId) }),
      findOneAndUpdate: async ({ rootVersionId }, { $set }) => listings.set(rootVersionId, $set),
      deleteOne: async ({ rootVersionId }) => listings.delete(rootVersionId),
    },
  });
  return { service, listings, disable: () => { enabled = false; } };
}
const owner = { visitorId: "owner" };
const share = (shareId) => ({ shareId, projectName: "Creation", artifactType: "game" });

test("publishing another version replaces one lineage slot, while separate creations coexist", async () => {
  const { service, listings } = fixture();
  await service.publish(owner, "first", share("AAAA"));
  await service.publish(owner, "second", share("BBBB"));
  assert.equal(listings.size, 1);
  assert.deepEqual(await service.get(owner, "first"), { isPublic: true, shareId: "BBBB" });
  await service.publish(owner, "separate", share("CCCC"));
  assert.equal(listings.size, 2);
  await service.unpublish(owner, "first");
  assert.deepEqual(await service.get(owner, "second"), { isPublic: false, shareId: null });
  assert.equal(listings.size, 1);
});

test("ownership is checked for reads, publications and removals", async () => {
  const { service, listings } = fixture();
  const stranger = { visitorId: "stranger" };
  await service.publish(owner, "first", share("AAAA"));
  for (const action of [() => service.get(stranger, "first"), () => service.publish(stranger, "first", share("BBBB")), () => service.unpublish(stranger, "first")]) {
    await assert.rejects(action, /Version not found/);
  }
  assert.equal(listings.get("root").shareId, "AAAA");
});

test("disabled Browse blocks publishing but still lets owners remove a listing", async () => {
  const { service, disable } = fixture();
  await service.publish(owner, "first", share("AAAA"));
  disable();
  await assert.rejects(() => service.requireEnabled(), { errorCode: "BROWSE_DISABLED" });
  await assert.rejects(() => service.publish(owner, "second", share("BBBB")), { errorCode: "BROWSE_DISABLED" });
  await service.unpublish(owner, "first");
  assert.equal((await service.get(owner, "first")).isPublic, false);
});

test("the database enforces one slot and a concurrent first publication retries as a replacement", async () => {
  assert.ok(PublicArtifact.schema.indexes().some(([keys, options]) => keys.rootVersionId === 1 && options.unique));
  const writes = [];
  const service = createPublicArtifacts({
    getSettings: async () => ({ enabled: true }),
    lineage: { get: async () => ({ id: "root" }) },
    ListingModel: { findOneAndUpdate: async (filter, update, options) => {
      writes.push({ filter, update, options });
      if (writes.length === 1) throw Object.assign(new Error("Duplicate"), { code: 11000 });
    } },
  });
  await service.publish(owner, "root", share("AAAA"));
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].filter, { rootVersionId: "root" });
  assert.equal(writes[1].options.upsert, undefined);
});
