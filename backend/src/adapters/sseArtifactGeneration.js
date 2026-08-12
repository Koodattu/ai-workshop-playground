function createSseArtifactGenerationAdapter(req, res, { heartbeatMs = 15000 } = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, heartbeatMs);

  const stopHeartbeat = () => clearInterval(heartbeat);
  req.once("close", stopHeartbeat);

  return {
    send(event) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    },
    close() {
      stopHeartbeat();
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    },
  };
}

module.exports = { createSseArtifactGenerationAdapter };
