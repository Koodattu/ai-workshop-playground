const test = require("node:test");
const assert = require("node:assert/strict");

const { MODEL_OPTIONS, MODEL_OPTION_IDS, getModelOption, getPublicModelCatalog } = require("../src/services/modelCatalog");

test("catalog owns one complete definition for every model option", () => {
  assert.equal(new Set(MODEL_OPTION_IDS).size, MODEL_OPTION_IDS.length);
  assert.deepEqual(Object.keys(MODEL_OPTIONS).sort(), [...MODEL_OPTION_IDS].sort());

  for (const id of MODEL_OPTION_IDS) {
    const option = getModelOption(id);
    assert.ok(option);
    assert.match(option.provider, /^(gemini|openai|deepseek)$/);
    assert.ok(option.model);
    assert.ok(option.label);
    assert.ok(option.adminLabel);
    assert.ok(option.description);
    assert.ok(option.translationKey);
    assert.ok(option.thinkingOptions.includes(option.defaultThinking));
    assert.ok(option.pricing.inputPerToken >= 0);
    assert.ok(option.pricing.outputPerToken >= 0);
  }
});

test("public catalog preserves ordering and overlays workshop settings", () => {
  const catalog = getPublicModelCatalog({
    balanced: { enabled: false, thinking: "high" },
    gpt54: { enabled: true, thinking: "medium" },
  });

  assert.deepEqual(
    catalog.map(({ id }) => id),
    MODEL_OPTION_IDS,
  );
  assert.equal(catalog[0].order, 0);
  assert.equal(catalog.find(({ id }) => id === "balanced").enabled, false);
  assert.equal(catalog.find(({ id }) => id === "balanced").thinking, "high");
  assert.equal(catalog.find(({ id }) => id === "gpt54").enabled, true);
  assert.equal(catalog.find(({ id }) => id === "gpt54").thinking, "medium");
});
