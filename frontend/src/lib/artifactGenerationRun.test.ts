import { describe, expect, it } from "vitest";
import { createArtifactGenerationRun } from "./artifactGenerationRun";
import type { StreamCallbacks } from "@/types";

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of values) collected.push(value);
  return collected;
}

describe("Artifact Generation Run", () => {
  it("materializes cumulative views and one completed outcome", async () => {
    let callbacks: StreamCallbacks = {};
    const run = createArtifactGenerationRun(async (nextCallbacks) => {
      callbacks = nextCallbacks;
      return () => {};
    });
    const viewsPromise = collect(run.display);

    await Promise.resolve();
    callbacks.onProgress?.("Think");
    callbacks.onProgress?.("ing");
    callbacks.onCodeStart?.();
    callbacks.onCodeChunk?.("<h1>");
    callbacks.onCodeChunk?.("Hello</h1>");
    callbacks.onCodeComplete?.();
    callbacks.onMessageComplete?.("Done");
    callbacks.onDone?.({ message: "Done", code: "<h1>Hello</h1>" });

    const views = await viewsPromise;
    const outcome = await run.outcome;

    expect(views.map((view) => view.revision)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(views[1].progress).toBe("Thinking");
    expect(views[4].artifact).toEqual({ code: "<h1>Hello</h1>", state: "streaming" });
    expect(views[5].artifact?.state).toBe("complete");
    expect(outcome).toEqual({ status: "completed", result: { message: "Done", code: "<h1>Hello</h1>" } });
  });

  it("closes display before exposing a failure", async () => {
    let callbacks: StreamCallbacks = {};
    const run = createArtifactGenerationRun(async (nextCallbacks) => {
      callbacks = nextCallbacks;
      return () => {};
    });
    const viewsPromise = collect(run.display);

    await Promise.resolve();
    callbacks.onError?.("Provider failed", 2, "AI_GENERATION_FAILED", ["detail"]);

    expect(await viewsPromise).toEqual([]);
    expect(await run.outcome).toEqual({
      status: "failed",
      error: { message: "Provider failed", remainingUses: 2, errorCode: "AI_GENERATION_FAILED", details: ["detail"] },
    });
  });

  it("cancellation is idempotent and terminal", async () => {
    let aborts = 0;
    const run = createArtifactGenerationRun(async () => () => {
      aborts += 1;
    });

    await Promise.resolve();
    run.cancel();
    run.cancel();

    expect(await run.outcome).toEqual({ status: "cancelled" });
    expect(aborts).toBe(1);
  });
});
