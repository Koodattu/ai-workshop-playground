const test = require("node:test");
const assert = require("node:assert/strict");

const { createWorkshopAccess } = require("../src/services/workshopAccess");
const { ERROR_CODES } = require("../src/constants/errorCodes");

function createPassword(overrides = {}) {
  return {
    _id: "password-id",
    isExpired: false,
    maxUsesPerUser: 3,
    ...overrides,
  };
}

test("inspect reports password quota without consuming it", async () => {
  let consumed = false;
  const access = createWorkshopAccess({
    PasswordModel: { findOne: async () => createPassword() },
    UsageModel: {
      getUsage: async () => 1,
      consumeWithinLimit: async () => {
        consumed = true;
      },
    },
  });

  const grant = await access.inspect({ authMode: "password", password: "WORKSHOP", visitorId: "visitor-1" });

  assert.equal(grant.authMode, "password");
  assert.equal(grant.remaining, 2);
  assert.equal(consumed, false);
});

test("grantForGeneration delegates atomic quota consumption", async () => {
  const calls = [];
  const access = createWorkshopAccess({
    PasswordModel: { findOne: async () => createPassword({ maxUsesPerUser: 5 }) },
    UsageModel: {
      getUsage: async () => 0,
      consumeWithinLimit: async (...args) => {
        calls.push(args);
        return { remaining: 3 };
      },
    },
  });

  const grant = await access.grantForGeneration({ authMode: "password", password: "WORKSHOP", visitorId: "visitor-1" });

  assert.deepEqual(calls, [["password-id", "visitor-1", 5]]);
  assert.equal(grant.remaining, 3);
});

test("grantForGeneration rejects exhausted quota", async () => {
  const access = createWorkshopAccess({
    PasswordModel: { findOne: async () => createPassword() },
    UsageModel: {
      getUsage: async () => 3,
      consumeWithinLimit: async () => null,
    },
  });

  await assert.rejects(
    access.grantForGeneration({ authMode: "password", password: "WORKSHOP", visitorId: "visitor-1" }),
    (error) => error.errorCode === ERROR_CODES.RATE_LIMIT_EXCEEDED && error.statusCode === 429,
  );
});

test("participant model keys stay behind an opaque authorization capability", async () => {
  const access = createWorkshopAccess();
  const grant = await access.grantForGeneration({
    authMode: "api-key",
    visitorId: "visitor-1",
    accessToken: "a-secure-session-token-123456",
    apiKeys: { openai: "secret-openai-key" },
  });

  assert.equal(grant.providerAuthorization.has("openai"), true);
  assert.equal(grant.providerAuthorization.get("openai"), "secret-openai-key");
  assert.equal(JSON.stringify(grant.providerAuthorization), "{}");
  assert.equal(Object.values(grant).includes("secret-openai-key"), false);
});
