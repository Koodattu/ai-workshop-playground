// Explicitly paid, local-only evaluation through the real API and persistence path.
// Example: node scripts/evaluate-prototype.js --live --model gpt56luna --case collector --output ../.cache/prototype-quality/luna-collector.json
const fs = require("node:fs");
const path = require("node:path");
const { validateScreenshot } = require("../src/services/generationContext");
require("dotenv").config({ quiet: true });

const cases = {
  collector: "Build a polished compact top-down star-collection game. Canvas 2D, fixed seed 4242 and five collectible stars, a 30-second round, arrow/WASD and touch controls, score, restart, optional procedural coin sound and mute. No external assets or libraries. Use the supplied tested recipes where useful. Expose the workshop state contract and keep seed, player position, remaining time and score restorable. Keep it under 250 lines. Make the first action obvious. Use English.",
  memory: "Build a polished small memory-card game with six matching pairs of simple inline SVG or emoji symbols. Fixed shuffle seed 4242, move counter, keyboard-accessible card buttons, touch support, win feedback and a restart button that reproduces the layout. No external assets or libraries. Expose the workshop state contract including layout, matched pairs, open cards and move count; restoring state must not strand a pending pair. Use English and keep it under 250 lines.",
};

async function main() {
  const args = process.argv.slice(2);
  const option = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  if (!args.includes("--live")) throw new Error("Pass --live to authorize paid provider calls.");
  const model = option("--model");
  if (!["gpt56luna", "deepseekv4flash"].includes(model)) throw new Error("Only GPT-6 Luna and DeepSeek V4.1 Flash are allowed by this evaluation.");
  const base = "http://localhost:5010";
  const headers = { "Content-Type": "application/json", "X-Admin-Secret": process.env.ADMIN_SECRET };
  const json = async (route, options = {}) => {
    const response = await fetch(base + route, { ...options, headers });
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
    return response.json();
  };
  const settings = (await json("/api/admin/model-settings")).models;
  for (const id of Object.keys(settings)) settings[id].enabled = ["gpt56luna", "deepseekv4flash"].includes(id);
  settings.gpt56luna.thinking = "medium";
  settings.deepseekv4flash.thinking = "low";
  await json("/api/admin/model-settings", { method: "PUT", body: JSON.stringify({ models: settings }) });

  const password = "prototype-quality-local";
  const listed = await json("/api/admin/passwords");
  const passwords = Array.isArray(listed) ? listed : listed.passwords;
  if (!passwords.some((entry) => entry.code === password)) await json("/api/admin/passwords", { method: "POST", body: JSON.stringify({ code: password, expiresAt: new Date(Date.now() + 86400000).toISOString(), maxUsesPerUser: 40 }) });
  const input = args.includes("--input") ? JSON.parse(fs.readFileSync(option("--input"), "utf8")) : null;
  let screenshot;
  if (args.includes("--screenshot")) {
    const bytes = fs.readFileSync(option("--screenshot"));
    const mime = bytes[0] === 255 ? "jpeg" : "png";
    screenshot = `data:image/${mime};base64,${bytes.toString("base64")}`;
    if (!validateScreenshot(screenshot)) throw new Error("Use a PNG or JPEG screenshot under 525 KB.");
  }
  const prompt = args.includes("--prompt-file") ? fs.readFileSync(option("--prompt-file"), "utf8") : cases[option("--case")];
  if (!prompt) throw new Error("Choose --case collector/memory or --prompt-file.");
  const body = { password, visitorId: `quality-eval-${model}`, modelPreference: model, artifactType: "game", mode: "edit", prompt,
    existingCode: input?.result?.code || "", parentVersionId: input?.result?.version?.id || null,
    artifactName: input?.result?.projectName,
    ...(input?.feedback ? { previewFeedback: input.feedback } : {}),
    ...(screenshot ? { screenshot } : {}) };
  const output = path.resolve(option("--output"));
  const started = Date.now();
  const response = await fetch(base + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(330000) });
  if (!response.ok) throw new Error(`Generation HTTP ${response.status}: ${await response.text()}`);
  let pending = "", result, failure;
  const decoder = new TextDecoder();
  const phases = [];
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    const events = pending.split("\n\n"); pending = events.pop();
    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const data = JSON.parse(event.slice(6));
      if (data.type === "status") { phases.push({ phase: data.phase, ms: Date.now() - started }); console.log(model, data.phase, `${Math.round((Date.now() - started) / 1000)}s`); }
      if (data.type === "done") result = data;
      if (data.type === "error") failure = data;
    }
  }
  if (result && result.usage.modelId !== (model === "gpt56luna" ? "gpt-6-luna" : "deepseek-flash")) throw new Error("Unexpected provider/model selected");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ prompt, model, durationMs: Date.now() - started, phases, result, failure }, null, 2));
  if (result) fs.writeFileSync(output.replace(/\.json$/, ".html"), result.code);
  console.log(JSON.stringify({ output, success: Boolean(result), durationMs: Date.now() - started, chars: result?.code.length, mode: result?.editMode, repair: result?.version?.patchRetryAttempted, usage: result?.usage, failure }));
  if (!result) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
