function createGenerationTelemetry({ requestId, model, mode, artifactType, send, now = Date.now, log = console.info }) {
  const startedAt = now();
  let phase;
  let firstOutputMs = null;
  let repairReason = null;
  const attempts = [];
  const elapsedMs = () => Math.max(0, now() - startedAt);
  return {
    elapsedMs,
    phase(next) {
      if (phase === next) return;
      phase = next;
      send({ type: "status", phase, requestId, elapsedMs: elapsedMs() });
    },
    output() { firstOutputMs ??= elapsedMs(); },
    repair(reason) { repairReason = reason; },
    attempt(usage) { attempts.push(usage || null); },
    finish(outcome, extra = {}) {
      log("[AI Run]", JSON.stringify({ requestId, provider: model.provider, model: model.model,
        modelPreference: model.id, thinking: model.thinking, mode, artifactType, outcome,
        durationMs: elapsedMs(), firstOutputMs, repairReason, attempts, ...extra }));
    },
  };
}

module.exports = { createGenerationTelemetry };
