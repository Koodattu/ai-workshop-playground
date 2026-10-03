import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import type { ArtifactGenerationView } from "./artifactGenerationRun";

afterEach(() => vi.unstubAllGlobals());
const request = { visitorId: "test-visitor", prompt: "Blue" };

describe("generation SSE transport", () => {
  it("delivers split status events and one final result, ignoring late data", async () => {
    const events = [
      { type: "status", phase: "thinking", requestId: "test", elapsedMs: 10 },
      { type: "status", phase: "checking", requestId: "test", elapsedMs: 20 },
      { type: "done", message: "Updated", code: "final", durationMs: 30 },
      { type: "code-chunk", chunk: "late" },
      { type: "error", error: "late" },
    ];
    const data = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(data.slice(0, 14)));
      controller.enqueue(encoder.encode(data.slice(14)));
      controller.close();
    } }))));
    const run = api.startArtifactGeneration(request);
    const views: ArtifactGenerationView[] = [];
    for await (const view of run.display) views.push(view);
    expect(views.map((view) => view.status?.phase)).toEqual(["thinking", "checking"]);
    expect(await run.outcome).toMatchObject({ status: "completed", result: { code: "final", durationMs: 30 } });
  });

  it("cancels a fetch that has not returned headers", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      signal = options.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const run = api.startArtifactGeneration(request);
    run.cancel();
    expect(signal?.aborted).toBe(true);
    expect(await run.outcome).toEqual({ status: "cancelled" });
  });

  it("reports a stream that closes without a terminal event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(": keep-alive\n\n")));
    const run = api.startArtifactGeneration(request);
    expect(await run.outcome).toMatchObject({ status: "failed", error: { errorCode: "AI_GENERATION_FAILED" } });
  });
});
