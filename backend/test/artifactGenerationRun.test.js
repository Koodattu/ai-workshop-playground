const test = require("node:test");
const assert = require("node:assert/strict");

const { createArtifactGenerationRunService } = require("../src/services/artifactGenerationRun");

const model = {
  id: "fast",
  provider: "gemini",
  model: "model-1",
  label: "Model One",
  shortLabel: "One",
  thinking: "low",
  pricing: { inputPerToken: 0.001, outputPerToken: 0.002 },
};

const generation = {
  mode: "edit",
  code: "after\nline",
  prompt: "Change it",
  message: "Done",
  projectName: "Demo Project",
  artifactType: "website",
  editMode: "replace_all",
  changeScope: "rewrite",
  edits: [],
  patchRetryAttempted: false,
  patchApplyMethod: null,
};

test("generation completion creates the version before returning its outcome", async () => {
  const calls = [];
  const service = createArtifactGenerationRunService({
    versionLineage: { create: async () => (calls.push("version"), { id: "version-1" }) },
    requestLog: { logRequest: async () => calls.push("request-log") },
    usage: { trackTokenUsage: async () => calls.push("usage") },
    validateArtifact: () => {},
  });

  const result = await service.finish({
    grant: { visitorId: "visitor-1", passwordId: "password-1" },
    parentVersionId: null,
    existingCode: "before",
    generation,
    model,
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  });

  assert.deepEqual(calls, ["version", "request-log", "usage"]);
  assert.equal(result.version.id, "version-1");
  assert.equal(result.usage.totalTokens, 15);
});

test("version creation failure fails the generation run", async () => {
  const expected = new Error("version unavailable");
  const service = createArtifactGenerationRunService({
    versionLineage: { create: async () => { throw expected; } },
    validateArtifact: () => {},
  });

  await assert.rejects(service.finish({ grant: { visitorId: "visitor-1" }, existingCode: "", generation, model }), expected);
});

test("token persistence is best-effort after a version is created", async () => {
  const errors = [];
  const service = createArtifactGenerationRunService({
    versionLineage: { create: async () => ({ id: "version-1" }) },
    requestLog: { logRequest: async () => { throw new Error("metrics unavailable"); } },
    usage: { trackTokenUsage: async () => {} },
    validateArtifact: () => {},
    logger: { error: (...args) => errors.push(args) },
  });

  const result = await service.finish({
    grant: { visitorId: "visitor-1", passwordId: "password-1" },
    existingCode: "before",
    generation,
    model,
  });

  assert.equal(result.version.id, "version-1");
  assert.equal(result.usage.totalTokens, 0);
  assert.equal(errors.length, 1);
});
