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
