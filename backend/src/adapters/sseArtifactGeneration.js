function createSseArtifactGenerationAdapter(req, res, { heartbeatMs = 15000, deadlineMs = 300000 } = {}) {
  const controller = new AbortController();
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

  const deadline = setTimeout(() => controller.abort(new DOMException("Generation time limit reached", "TimeoutError")), deadlineMs);
  const stopTimers = () => { clearInterval(heartbeat); clearTimeout(deadline); };
  const disconnect = () => {
    stopTimers();
    if (!res.writableEnded) controller.abort(new DOMException("Client disconnected", "AbortError"));
  };
  // IncomingMessage.close also fires after the request body is read normally.
  res.once("close", disconnect);
  req.once("aborted", disconnect);
  if (req.aborted || res.destroyed) disconnect();

  return {
    signal: controller.signal,
    commit() { controller.signal.throwIfAborted(); clearTimeout(deadline); },
    send(event) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    },
    close() {
      stopTimers();
      res.removeListener("close", disconnect);
      req.removeListener("aborted", disconnect);
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    },
  };
}

module.exports = { createSseArtifactGenerationAdapter };
