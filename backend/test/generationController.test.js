const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

// Exercise the real controller, validation, repair, and SSE framing. Only external
// provider calls, configuration, and persistence are replaced; no keys or DB needed.
function stub(id, exports) {
  const filename = require.resolve(id);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
let plans = [];
let calls = [];
let saves = [];
let onCall = () => {};
let onSummary = () => {};
async function providerStream(provider, request, signal) {
  calls.push({ provider, request, signal });
  onCall(signal);
  const plan = plans.shift();
  if (plan === "wait") {
    return new Promise((_, reject) => {
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }
  assert.equal(typeof plan, "string", "unexpected extra provider attempt");
  return (async function* () {
    if (provider === "openai") {
      yield { type: "response.output_item.added", item: { type: "reasoning" } };
      yield { type: "response.output_text.delta", delta: plan };
      yield { type: "response.completed", response: { usage: { input_tokens: 20, output_tokens: 10 } } };
    } else if (provider === "deepseek") {
      yield { choices: [{ delta: { reasoning_content: "hidden" } }] };
      yield { choices: [{ delta: { content: plan } }], usage: { prompt_tokens: 20, completion_tokens: 10 } };
    } else {
      yield { candidates: [{ content: { parts: [{ thought: true, text: "hidden" }] } }] };
      yield { candidates: [{ content: { parts: [{ text: plan }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10 } };
    }
  })();
}
class FakeOpenAI {
  responses = { create: (request, options) => providerStream("openai", request, options.signal) };
  chat = { completions: { create: (request, options) => providerStream("deepseek", request, options.signal) } };
}
stub("openai", FakeOpenAI);
stub("@google/genai", {
  ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
  GoogleGenAI: class { models = { generateContentStream: (request) => providerStream("gemini", request, request.config.abortSignal) }; },
});
stub("../src/config", {});
stub("../src/services/modelSettings", {
  getAllowedModelPreference: async (id) => id,
  getModelSetting: async () => ({ thinking: "low" }),
  normalizeThinkingLevel: (value, allowed, fallback) => allowed.includes(value) ? value : fallback,
});
stub("../src/services/artifactGenerationRun", { artifactGenerationRunService: { finish: async (input) => {
  saves.push(input);
  return { version: input.generation.mode === "edit" ? { id: "saved-version" } : null, usage: null };
} } });
const { generateCode } = require("../src/controllers/aiController");
const original = '<!DOCTYPE html><html><body><button style="color:red">Play</button><script>let score = 0;</script></body></html>';
const patch = (oldText = "color:red") => JSON.stringify({ message: "Updated", projectName: "Button Demo", editMode: "patch", changeScope: "localized", code: "", edits: [{ oldText, newText: "color:blue" }] });

function start(t, modelPreference, responses, body = {}) {
  plans = [...responses]; calls = []; saves = []; onCall = () => {};
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  onSummary = finish;
  t.mock.method(console, "info", (label, value) => { if (label === "[AI Run]") onSummary(JSON.parse(value)); });
  t.mock.method(console, "error", () => {});
  const req = Object.assign(new EventEmitter(), {
    body: { prompt: "Blue", existingCode: original, mode: "edit", modelPreference, ...body },
    workshop: { authMode: "api-key" }, workshopAccessGrant: { providerAuthorization: new Map([["gemini", "test"], ["openai", "test"], ["deepseek", "test"]]) },
  });
  const events = [];
  const res = Object.assign(new EventEmitter(), {
    writeHead() {}, flushHeaders() {},
    write(data) { if (data.startsWith("data: ")) events.push(JSON.parse(data.slice(6))); },
    end() { this.writableEnded = true; this.emit("close"); },
  });
  generateCode(req, res, (error) => { throw error; });
  return { req, res, events, finished };
}

for (const model of ["balanced", "gpt54mini", "deepseekv4flash"]) {
  test(`${model}: patches reach saving and done with phases but no hidden thoughts`, async (t) => {
    const run = start(t, model, [patch()]);
    const summary = await run.finished;
    assert.equal(summary.outcome, "completed");
    assert.deepEqual(run.events.filter((e) => e.type === "status").map((e) => e.phase), ["working", "thinking", "writing", "checking", "saving"]);
    assert.equal(run.events.some((e) => e.type === "progress"), false);
    assert.equal(run.events.at(-1).code, original.replace("color:red", "color:blue"));
    assert.equal(saves.length, 1);
    assert.equal(calls[0].signal.aborted, false);
  });

  test(`${model}: disconnect while awaiting provider headers aborts upstream`, async (t) => {
    const run = start(t, model, ["wait"]);
    onCall = () => { run.res.destroyed = true; run.res.emit("close"); };
    const summary = await run.finished;
    assert.equal(summary.outcome, "cancelled");
    assert.equal(calls[0].signal.aborted, true);
    assert.equal(saves.length, 0);
    assert.equal(run.events.some((e) => e.type === "done"), false);
  });
}

test("malformed response repairs once, accounts for both calls, and persists only the valid result", async (t) => {
  const run = start(t, "gpt54mini", ["{", patch()]);
  const summary = await run.finished;
  assert.equal(summary.repairReason, "invalid-response");
  assert.equal(summary.attempts.length, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[1].request.input, /VALIDATION FEEDBACK/);
  assert.match(calls[1].request.input, /color:red/);
  assert.equal(saves[0].usageMetadata.promptTokenCount, 40);
  assert.equal(saves[0].generation.patchRetryAttempted, true);
  assert.equal(run.events.at(-1).type, "done");
});

test("two invalid responses yield an error and never persist", async (t) => {
  const run = start(t, "balanced", [patch("missing"), patch("still-missing")]);
  assert.equal((await run.finished).outcome, "failed");
  assert.equal(calls.length, 2);
  assert.equal(saves.length, 0);
  assert.equal(run.events.at(-1).errorCode, "AI_EDIT_UNSAFE");
});

test("disconnect during the repair aborts the second provider call and never persists", async (t) => {
  const run = start(t, "gpt54mini", ["{", "wait"]);
  onCall = () => {
    if (calls.length === 2) { run.res.destroyed = true; run.res.emit("close"); }
  };
  assert.equal((await run.finished).outcome, "cancelled");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(saves.length, 0);
});

test("full replacement streams provisionally and completes with the validated document", async (t) => {
  const response = JSON.stringify({ message: "Created", projectName: "Button Demo", editMode: "replace_all", changeScope: "rewrite", code: original, edits: [] });
  const run = start(t, "gpt54mini", [response], { existingCode: "" });
  await run.finished;
  assert.ok(run.events.some((e) => e.type === "code-start"));
  assert.equal(run.events.filter((e) => e.type === "code-chunk").map((e) => e.chunk).join(""), original);
  assert.equal(run.events.at(-1).code, original);
});

test("auto answers report answering, never writing code", async (t) => {
  const response = JSON.stringify({ action: "ask", message: "The button increments the count.", code: "", projectName: "", edits: [], editMode: "replace_all", changeScope: "localized" });
  const run = start(t, "gpt54mini", [response], { mode: "auto" });
  await run.finished;
  const phases = run.events.filter((event) => event.type === "status").map((event) => event.phase);
  assert.ok(phases.includes("answering"));
  assert.equal(phases.includes("writing"), false);
  assert.equal(run.events.at(-1).mode, "ask");
  assert.equal(saves[0].generation.code, "");
});
