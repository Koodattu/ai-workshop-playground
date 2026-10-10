import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import type { ArtifactGenerationView } from "./artifactGenerationRun";

afterEach(() => vi.unstubAllGlobals());
const request = { visitorId: "test-visitor", prompt: "Blue" };

describe("Browse moderation transport", () => {
  it("authenticates listing and hide/restore requests and returns the server state", async () => {
    const artifact = { _id: "test-id", shareId: "ABCD", projectName: "Test", artifactType: "website", hiddenByAdmin: true };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ artifacts: [artifact], hasMore: true }))
      .mockResolvedValueOnce(Response.json(artifact))
      .mockResolvedValueOnce(Response.json({ ...artifact, hiddenByAdmin: false }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api.getAdminBrowseArtifacts("test-secret", 2)).toEqual({ artifacts: [artifact], hasMore: true });
    expect(await api.setBrowseArtifactHidden("test-secret", artifact._id, true)).toEqual(artifact);
    expect((await api.setBrowseArtifactHidden("test-secret", artifact._id, false)).hiddenByAdmin).toBe(false);
    expect(fetchMock.mock.calls[0]).toEqual([expect.stringContaining("/api/admin/browse-artifacts?page=2"), expect.objectContaining({ cache: "no-store", headers: expect.objectContaining({ "X-Admin-Secret": "test-secret" }) })]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ hiddenByAdmin: true }), headers: { "X-Admin-Secret": "test-secret" } });
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ hiddenByAdmin: false }));
  });

  it("reports rejected moderation without pretending the visibility changed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Unauthorized" }, { status: 401 })));
    await expect(api.setBrowseArtifactHidden("invalid", "test-id", true)).rejects.toThrow("Unauthorized");
  });
});

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
