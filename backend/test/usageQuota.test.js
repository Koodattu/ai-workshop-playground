const test = require("node:test");
const assert = require("node:assert/strict");

const Usage = require("../src/models/Usage");

test("consumeWithinLimit uses one conditional atomic update", async () => {
  let operation;
  const result = await Usage.consumeWithinLimit.call(
    {
      findOneAndUpdate: async (...args) => {
        operation = args;
        return { useCount: 2 };
      },
    },
    "password-id",
    "visitor-id",
    4,
  );

  const [filter, update, options] = operation;
  assert.equal(filter.passwordId, "password-id");
  assert.equal(filter.visitorId, "visitor-id");
  assert.deepEqual(filter.$or, [{ useCount: { $lt: 4 } }, { useCount: { $exists: false } }]);
  assert.deepEqual(update.$inc, { useCount: 1 });
  assert.equal(options.upsert, true);
  assert.equal(result.remaining, 2);
});

test("consumeWithinLimit treats a unique-index collision as exhausted quota", async () => {
  let calls = 0;
  const result = await Usage.consumeWithinLimit.call(
    {
      findOneAndUpdate: async () => {
        calls += 1;
        if (calls > 1) return null;
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      },
    },
    "password-id",
    "visitor-id",
    1,
  );

  assert.equal(result, null);
  assert.equal(calls, 2);
});

test("consumeWithinLimit retries a concurrent first-use upsert", async () => {
  let calls = 0;
  const result = await Usage.consumeWithinLimit.call(
    {
      findOneAndUpdate: async () => {
        calls += 1;
        if (calls === 1) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }
        return { useCount: 2 };
      },
    },
    "password-id",
    "visitor-id",
    4,
  );

  assert.equal(result.remaining, 2);
  assert.equal(calls, 2);
});
