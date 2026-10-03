const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveArtifactResponse, resolveWithOneRepair } = require("../src/services/artifactResponse");

const original = '<!DOCTYPE html><html><body><button style="color:red">Play</button><script>let score = 0;</script></body></html>';
const patch = (edits) => JSON.stringify({ message: "Updated", projectName: "Button Demo", editMode: "patch", changeScope: "localized", code: "", edits });
const valid = patch([{ oldText: "color:red", newText: "color:blue" }]);
const options = { responseMode: "edit", existingCode: original };

for (const [name, text] of [
  ["malformed JSON", "{"],
  ["invalid schema", JSON.stringify({ message: 1, editMode: "other" })],
  ["missing patch match", patch([{ oldText: "color:green", newText: "color:blue" }])],
  ["broken JavaScript", patch([{ oldText: "let score = 0;", newText: "let = ;" }])],
]) {
  test(`repairs ${name} once against the original snapshot`, async () => {
    let calls = 0;
    const result = await resolveWithOneRepair({ ...options, text, repair: async ({ error, candidate }) => {
      calls += 1;
      assert.ok(error.retryFeedback);
      assert.equal(candidate, text);
      return valid;
    } });
    assert.equal(calls, 1);
    assert.equal(result.repairAttempted, true);
    assert.equal(result.code, original.replace("color:red", "color:blue"));
  });
}

test("a valid response never calls repair", async () => {
  const result = await resolveWithOneRepair({ ...options, text: valid, repair() { assert.fail("unnecessary repair"); } });
  assert.equal(result.repairAttempted, false);
});

test("a second invalid result fails without a third attempt", async () => {
  let calls = 0;
  await assert.rejects(resolveWithOneRepair({ ...options, text: "{", repair: async () => { calls += 1; return "{"; } }),
    (error) => error.reason === "invalid-response");
  assert.equal(calls, 1);
});

test("cancellation during repair prevents validation or saving its result", async () => {
  const controller = new AbortController();
  await assert.rejects(resolveWithOneRepair({ ...options, text: "{", signal: controller.signal, repair: async () => {
    controller.abort();
    return valid;
  } }), { name: "AbortError" });
});

test("ask output cannot smuggle edits; full replacements require empty edits", () => {
  const ask = { action: "ask", message: "Try increasing speed", code: "", projectName: "", editMode: "replace_all", changeScope: "localized", edits: [] };
  assert.equal(resolveArtifactResponse(JSON.stringify(ask), { responseMode: "auto" }).mode, "ask");
  assert.throws(() => resolveArtifactResponse(JSON.stringify({ ...ask, code: original }), { responseMode: "auto" }));
  assert.throws(() => resolveArtifactResponse(JSON.stringify({ ...JSON.parse(valid), editMode: "replace_all", code: original }), options));
});
