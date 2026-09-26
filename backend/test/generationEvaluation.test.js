const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeRuns } = require("../scripts/summarize-generation-runs");

test("evaluation groups reasoning settings and keeps missing usage distinct from zero", () => {
  const base = { provider: "p", model: "m", mode: "edit", artifactType: "game", thinking: "low" };
  const runs = [
    { ...base, outcome: "completed", durationMs: 100, firstOutputMs: 20, attempts: [{ totalTokenCount: 30 }] },
    { ...base, outcome: "completed", durationMs: 300, firstOutputMs: 40, repairReason: "invalid-response", attempts: [{ totalTokenCount: 50 }, { totalTokenCount: 20 }] },
    { ...base, outcome: "cancelled", durationMs: 50, firstOutputMs: null, attempts: [null] },
    { ...base, thinking: "medium", outcome: "failed", durationMs: 200, attempts: [null] },
  ];
  const result = summarizeRuns("unrelated log\n" + runs.map((run) => "[AI Run] " + JSON.stringify(run)).join("\n"));
  assert.equal(result.length, 2);
  assert.equal(result[0].completedP50Ms, 100);
  assert.equal(result[0].completedP95Ms, 300);
  assert.equal(result[0].firstOutputP50Ms, 20);
  assert.equal(result[0].repairs, 1);
  assert.equal(result[0].runsWithKnownUsage, 2);
  assert.equal(result[1].medianTotalTokens, null);
});
