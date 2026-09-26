const test = require("node:test");
const assert = require("node:assert/strict");
const { createGenerationTelemetry } = require("../src/services/generationTelemetry");

test("telemetry reports phases and failed-run measurements without prompt or code content", () => {
  let clock = 100;
  const events = [];
  const logs = [];
  const telemetry = createGenerationTelemetry({ requestId: "test", model: { model: "m", provider: "p", thinking: "low" },
    mode: "edit", artifactType: "game", now: () => clock, send: (event) => events.push(event), log: (_, data) => logs.push(JSON.parse(data)) });
  telemetry.phase("working");
  telemetry.phase("working");
  clock = 250;
  telemetry.output();
  clock = 400;
  telemetry.output();
  telemetry.repair("inline-script-syntax");
  telemetry.phase("repairing");
  telemetry.attempt(null);
  telemetry.finish("cancelled");
  assert.equal(events.length, 2);
  assert.equal(logs[0].durationMs, 300);
  assert.equal(logs[0].firstOutputMs, 150);
  assert.deepEqual(logs[0].attempts, [null]);
  assert.equal(logs[0].outcome, "cancelled");
  assert.equal(logs[0].repairReason, "inline-script-syntax");
});
