const test = require("node:test");
const assert = require("node:assert/strict");

// Opt in against a disposable local MongoDB, never the configured application database.
test("Browse API with MongoDB", { skip: !process.env.BROWSE_TEST_MONGO_URI }, async (t) => {
  const uri = process.env.BROWSE_TEST_MONGO_URI;
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/?$/);
  process.env.ADMIN_SECRET = "browse-integration-test-only";
  process.env.NODE_ENV = "test";
  const mongoose = require("mongoose");
  const express = require("express");
  const { hashAccessToken } = require("../src/services/workshopAccess");
  const CodeVersion = require("../src/models/CodeVersion");
  const PublicArtifact = require("../src/models/PublicArtifact");
  const SharedCode = require("../src/models/SharedCode");
  const SystemSetting = require("../src/models/SystemSetting");
  await mongoose.connect(uri, { dbName: `codex_browse_test_${process.pid}_${Date.now()}` });
  const app = express();
  app.use(express.json());
  app.use("/api/browse", require("../src/routes/browse"));
  app.use("/api/share", require("../src/routes/share"));
  app.use("/api/admin", require("../src/routes/admin"));
  app.use(require("../src/middleware/errorHandler").errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([PublicArtifact.init(), SharedCode.init(), SystemSetting.init()]);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const access = { authMode: "api-key", visitorId: "integration-owner", apiKeyAccessToken: "integration-owner-token-at-least-24-characters" };
  const versionData = { visitorId: access.visitorId, accessMode: access.authMode, ownerTokenHash: hashAccessToken(access.apiKeyAccessToken), code: "<h1>First</h1>", projectName: "First" };
  const first = await CodeVersion.create(versionData);
  const next = await CodeVersion.create({ ...versionData, rootVersionId: first._id, parentVersionId: first._id });
  const other = await CodeVersion.create(versionData);
  const request = (path, body, method = "POST", headers = {}) => fetch(`${baseUrl}${path}`, { method: body ? method : "GET", headers: { "Content-Type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const publish = (version, extra = {}) => request(`/api/browse/${version._id}`, { ...access, isPublic: true, code: "<h1>Published</h1>", projectName: "Published", artifactType: "game", ...extra }, "PUT");
  let originalShareId;

  await t.test("legacy links remain unlisted; publishing and replacing preserves snapshots", async () => {
    const privateResponse = await request("/api/share", { code: "<h1>Private</h1>" });
    assert.equal(privateResponse.status, 201);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 0);
    const firstPublication = await publish(first);
    assert.equal(firstPublication.status, 200);
    originalShareId = (await firstPublication.json()).shareId;
    assert.equal((await publish(next, { code: "<h1>Updated</h1>" })).status, 200);
    const gallery = await (await request("/api/browse")).json();
    assert.equal(gallery.artifacts.length, 1);
    assert.notEqual(gallery.artifacts[0].shareId, originalShareId);
    assert.equal(gallery.artifacts[0].code, undefined);
    assert.equal(gallery.artifacts[0].rootVersionId, undefined);
    const oldShare = await (await request(`/api/share/${originalShareId}`)).json();
    assert.equal(oldShare.data.code, "<h1>Published</h1>");
  });

  await t.test("concurrent publications cannot create duplicate gallery cards", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => publish(other)));
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(await PublicArtifact.countDocuments({ rootVersionId: other._id }), 1);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 2);
  });

  await t.test("ownership and boolean/content validation protect publishing", async () => {
    const before = await SharedCode.countDocuments();
    assert.equal((await publish(first, { visitorId: "someone-else" })).status, 404);
    assert.equal((await publish(first, { apiKeyAccessToken: "different-token-at-least-24-characters" })).status, 404);
    assert.equal((await publish(first, { code: undefined })).status, 400);
    assert.equal((await publish(first, { isPublic: "false" })).status, 400);
    assert.equal((await publish(first, { thumbnail: "data:image/svg+xml;base64,PHN2Zz4=" })).status, 400);
    assert.equal((await publish(first, { thumbnail: "https://example.com/image.webp" })).status, 400);
    assert.equal(await SharedCode.countDocuments(), before);
  });

  await t.test("only public previews render and their scripts are sandboxed", async () => {
    const { artifacts } = await (await request("/api/browse")).json();
    const preview = await request(`/api/browse/${artifacts[0].shareId}/preview`);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("content-security-policy"), /sandbox; default-src 'none'/);
    assert.doesNotMatch(preview.headers.get("content-security-policy"), /allow-scripts/);
    assert.equal((await request(`/api/browse/${originalShareId}/preview`)).status, 404);
  });

  await t.test("admin disable blocks listing, preview and publication; links and removal still work", async () => {
    assert.equal((await request("/api/admin/browse-settings", { enabled: false }, "PUT")).status, 401);
    const headers = { "X-Admin-Secret": process.env.ADMIN_SECRET };
    assert.equal((await request("/api/admin/browse-settings", { enabled: false }, "PUT", headers)).status, 200);
    assert.equal((await request("/api/browse")).status, 403);
    assert.equal((await request(`/api/browse/${originalShareId}/preview`)).status, 403);
    assert.equal((await publish(first)).status, 403);
    assert.equal((await request(`/api/share/${originalShareId}`)).status, 200);
    const removal = await request(`/api/browse/${first._id}`, { ...access, isPublic: false }, "PUT");
    assert.equal(removal.status, 200);
    assert.equal(await PublicArtifact.countDocuments({ rootVersionId: first._id, isPublic: { $ne: false } }), 0);
    assert.equal((await request("/api/admin/browse-settings", { enabled: true }, "PUT", headers)).status, 200);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 1);
  });

  await t.test("admin moderation hides and restores a project without breaking shares or allowing owner bypass", async () => {
    const thumbnail = "data:image/webp;base64,dGVzdA==";
    await PublicArtifact.updateOne({ rootVersionId: other._id }, { $set: { thumbnail } });
    const headers = { "X-Admin-Secret": process.env.ADMIN_SECRET };
    const list = () => request("/api/admin/browse-artifacts", null, "GET", headers);
    assert.equal((await request("/api/admin/browse-artifacts")).status, 401);
    assert.equal((await request("/api/admin/browse-artifacts?page=-1", null, "GET", headers)).status, 400);
    const listing = (await (await list()).json()).artifacts[0];
    assert.equal(listing.thumbnail, thumbnail);
    assert.equal(listing.rootVersionId, undefined);
    const moderate = (hiddenByAdmin, extraHeaders = headers) => request(`/api/admin/browse-artifacts/${listing._id}`, { hiddenByAdmin }, "PUT", extraHeaders);
    assert.equal((await moderate(true, {})).status, 401);
    assert.equal((await moderate(true, { "X-Admin-Secret": "incorrect" })).status, 401);
    assert.equal((await moderate("true")).status, 400);
    assert.equal((await request("/api/admin/browse-artifacts/not-an-id", { hiddenByAdmin: true }, "PUT", headers)).status, 400);
    assert.equal((await request(`/api/admin/browse-artifacts/${new mongoose.Types.ObjectId()}`, { hiddenByAdmin: true }, "PUT", headers)).status, 404);
    const hidden = await moderate(true);
    assert.equal(hidden.status, 200);
    assert.equal((await hidden.json()).thumbnail, thumbnail);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 0);
    assert.equal((await request(`/api/browse/${listing.shareId}/preview`)).status, 404);
    assert.equal((await request(`/api/share/${listing.shareId}`)).status, 200);
    assert.equal((await (await list()).json()).artifacts[0].hiddenByAdmin, true);
    assert.equal((await (await publish(other, { hiddenByAdmin: false })).json()).hiddenByAdmin, true);
    await request(`/api/browse/${other._id}`, { ...access, isPublic: false }, "PUT");
    assert.equal((await (await publish(other)).json()).hiddenByAdmin, true);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 0);
    // Moderation remains available while Browse itself is disabled.
    await request("/api/admin/browse-settings", { enabled: false }, "PUT", headers);
    assert.equal((await list()).status, 200);
    assert.equal((await moderate(false)).status, 200);
    await request("/api/admin/browse-settings", { enabled: true }, "PUT", headers);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 1);
    // Older listings have neither field and must remain visible and moderatable.
    await PublicArtifact.collection.updateOne({ _id: new mongoose.Types.ObjectId(listing._id) }, { $unset: { isPublic: "", hiddenByAdmin: "" } });
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 1);
    assert.equal((await moderate(true)).status, 200);
    assert.equal((await (await request("/api/browse")).json()).artifacts.length, 0);
    await moderate(false);
  });

  await t.test("gallery pagination bounds results and omits private metadata", async () => {
    await PublicArtifact.insertMany(Array.from({ length: 13 }, (_, i) => ({ rootVersionId: new mongoose.Types.ObjectId(), shareId: `TEST`, projectName: `Item ${i}` })));
    const page1 = await (await request("/api/browse?page=1")).json();
    const page2 = await (await request("/api/browse?page=2")).json();
    assert.equal(page1.artifacts.length, 12);
    assert.equal(page1.hasMore, true);
    assert.equal(page2.artifacts.length, 2);
    assert.equal(page2.hasMore, false);
    assert.equal((await request("/api/browse?page=-1")).status, 400);
  });
});
