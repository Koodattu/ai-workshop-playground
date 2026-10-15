const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

function runWithSecret(adminSecret, geminiApiKey = "test-only-key") {
  const env = { ...process.env, NODE_ENV: "production", GEMINI_API_KEY: geminiApiKey };
  if (adminSecret === undefined) delete env.ADMIN_SECRET;
  else env.ADMIN_SECRET = adminSecret;

  return spawnSync(process.execPath, ["-e", `
    const assert = require("node:assert/strict");
    // Isolate configuration from the developer's .env file.
    require("dotenv").config = () => ({});
    const config = require("./src/config");
    assert.equal(config.adminSecret, process.env.ADMIN_SECRET);
    const { verifyAdmin } = require("./src/controllers/adminController");
    function verify(secret) {
      return new Promise((resolve) => {
        verifyAdmin({ headers: { "x-admin-secret": secret } }, {}, resolve);
      });
    }
    (async () => {
      const matching = await verify(config.adminSecret);
      if (config.adminSecret) assert.equal(matching, undefined);
      else assert.equal(matching.statusCode, 401);
      for (const secret of [undefined, "", "incorrect-test-secret"]) {
        assert.equal((await verify(secret)).statusCode, 401);
      }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `], { cwd: path.join(__dirname, ".."), env, encoding: "utf8" });
}

for (const [name, secret] of [
  ["single-character", "a"],
  ["common", "password"],
  ["placeholder", "your-admin-secret"],
  ["punctuation", "test!#$%&*+='\"\\"],
  ["long", "a".repeat(1024)],
  ["empty", ""],
  ["unset", undefined],
]) {
  test(`production accepts ${name} admin secret and enforces admin authentication`, () => {
    const result = runWithSecret(secret);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  });
}

test("production still requires the Gemini API key", () => {
  const result = runWithSecret("a", "");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variables: GEMINI_API_KEY/);
});
