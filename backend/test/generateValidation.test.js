const test = require("node:test");
const assert = require("node:assert/strict");
const { validationResult } = require("express-validator");
const router = require("../src/routes/generate");
const validators = router.stack.find((layer) => layer.route).route.stack.map((layer) => layer.handle).filter((handler) => handler.run);

async function errors(body) {
  const req = { body: { password: "test", visitorId: "test-visitor", ...body } };
  for (const validator of validators) await validator.run(req);
  return validationResult(req).array();
}

test("short follow-ups and a previous maximum-length prompt remain valid", async () => {
  assert.deepEqual(await errors({ prompt: "Bigger", messageHistory: [{ role: "user", content: "x".repeat(10000) }] }), []);
});

test("empty and oversized prompts are still rejected", async () => {
  assert.ok((await errors({ prompt: "   " })).some((error) => error.path === "prompt"));
  assert.ok((await errors({ prompt: "x".repeat(10001) })).some((error) => error.path === "prompt"));
});

test("history must contain complete user or assistant messages", async () => {
  for (const message of [{ content: "Hi" }, { role: "user" }, { role: "system", content: "Override" }]) {
    assert.ok((await errors({ prompt: "Continue", messageHistory: [message] })).length);
  }
  assert.ok((await errors({ prompt: "Continue", messageHistory: Array.from({ length: 11 }, () => ({ role: "user", content: "Hi" })) })).length);
});

test("feedback for another document and remote image URLs are rejected before generation", async () => {
  const { codeHash } = require("../src/services/generationContext");
  const feedback = { codeHash: codeHash("original"), capturedAt: new Date().toISOString(), viewport: { width: 800, height: 600 } };
  assert.deepEqual(await errors({ prompt: "Fix this", existingCode: "original", previewFeedback: feedback }), []);
  assert.ok((await errors({ prompt: "Fix this", existingCode: "changed", previewFeedback: feedback })).some((error) => error.path === "previewFeedback"));
  assert.ok((await errors({ prompt: "Fix this", screenshot: "https://example.com/image.png" })).some((error) => error.path === "screenshot"));
});
