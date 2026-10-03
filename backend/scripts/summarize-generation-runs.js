const fs = require("node:fs");

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}

function summarizeRuns(text) {
  const groups = new Map();
  for (const line of text.split(/\r?\n/)) {
    const marker = line.indexOf("[AI Run] ");
    if (marker < 0) continue;
    let run;
    try { run = JSON.parse(line.slice(marker + 9)); } catch { continue; }
    const key = [run.provider, run.model, run.thinking, run.mode, run.artifactType].join(" / ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(run);
  }
  return [...groups].map(([group, runs]) => {
    const completed = runs.filter((run) => run.outcome === "completed");
    const knownUsage = runs.filter((run) => run.attempts?.length && run.attempts.every((usage) => usage !== null));
    const totals = knownUsage.map((run) => run.attempts.reduce((sum, usage) => sum + (usage.totalTokenCount ??
      (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)), 0));
    return {
      group, runs: runs.length, completed: completed.length,
      failed: runs.filter((run) => run.outcome === "failed").length,
      cancelled: runs.filter((run) => run.outcome === "cancelled").length,
      timedOut: runs.filter((run) => run.outcome === "timeout").length,
      repairs: runs.filter((run) => run.repairReason).length,
      completedP50Ms: percentile(completed.map((run) => run.durationMs), 0.5),
      completedP95Ms: percentile(completed.map((run) => run.durationMs), 0.95),
      firstOutputP50Ms: percentile(runs.map((run) => run.firstOutputMs), 0.5),
      runsWithKnownUsage: knownUsage.length,
      medianTotalTokens: percentile(totals, 0.5),
    };
  });
}

if (require.main === module) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/summarize-generation-runs.js <server-log-file>");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(summarizeRuns(fs.readFileSync(path, "utf8")), null, 2));
  }
}

module.exports = { summarizeRuns };
