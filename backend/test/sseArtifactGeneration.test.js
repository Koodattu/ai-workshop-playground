const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createSseArtifactGenerationAdapter } = require("../src/adapters/sseArtifactGeneration");

test("SSE adapter preserves headers, event framing, and closure", () => {
  const req = new EventEmitter();
  const writes = [];
  let headers;
  let ended = false;
  const res = Object.assign(new EventEmitter(), {
    destroyed: false,
    writableEnded: false,
    writeHead(status, nextHeaders) {
      headers = { status, ...nextHeaders };
    },
    flushHeaders() {},
    write(value) {
      writes.push(value);
    },
    end() {
      ended = true;
      this.writableEnded = true;
    },
  });

  const adapter = createSseArtifactGenerationAdapter(req, res, { heartbeatMs: 60000 });
  adapter.send({ type: "progress", delta: "Working" });
  adapter.close();

  assert.equal(headers.status, 200);
  assert.equal(headers["Content-Type"], "text/event-stream");
  assert.equal(writes[0], 'data: {"type":"progress","delta":"Working"}\n\n');
  assert.equal(ended, true);
  assert.equal(adapter.signal.aborted, false);
  assert.equal(res.listenerCount("close"), 0);
});

test("normal request completion keeps generation alive; response disconnect aborts it", () => {
  const req = new EventEmitter();
  const res = Object.assign(new EventEmitter(), { writeHead() {}, write() {}, end() {} });
  const adapter = createSseArtifactGenerationAdapter(req, res);
  req.emit("close");
  assert.equal(adapter.signal.aborted, false);
  res.emit("close");
  assert.equal(adapter.signal.aborted, true);
  assert.throws(() => adapter.commit(), { name: "AbortError" });
  adapter.close();
});

test("deadline aborts even while heartbeats continue", async () => {
  const req = new EventEmitter();
  const res = Object.assign(new EventEmitter(), { writeHead() {}, write() {}, end() {} });
  const adapter = createSseArtifactGenerationAdapter(req, res, { heartbeatMs: 1, deadlineMs: 10 });
  await new Promise((resolve) => adapter.signal.addEventListener("abort", resolve, { once: true }));
  assert.equal(adapter.signal.reason.name, "TimeoutError");
  adapter.close();
});
