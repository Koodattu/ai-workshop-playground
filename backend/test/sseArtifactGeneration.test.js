const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createSseArtifactGenerationAdapter } = require("../src/adapters/sseArtifactGeneration");

test("SSE adapter preserves headers, event framing, and closure", () => {
  const req = new EventEmitter();
  const writes = [];
  let headers;
  let ended = false;
  const res = {
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
  };

  const adapter = createSseArtifactGenerationAdapter(req, res, { heartbeatMs: 60000 });
  adapter.send({ type: "progress", delta: "Working" });
  adapter.close();

  assert.equal(headers.status, 200);
  assert.equal(headers["Content-Type"], "text/event-stream");
  assert.equal(writes[0], 'data: {"type":"progress","delta":"Working"}\n\n');
  assert.equal(ended, true);
});
