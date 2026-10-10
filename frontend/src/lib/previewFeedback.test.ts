import { describe, it, expect } from "vitest";
import { appendScreenshots, hashArtifact, snapshotState, isCurrentPreviewMessage } from "./previewFeedback";

describe("image attachments", () => {
  it("appends uploads and captures in order without replacing previous images", () => {
    const current = ["first"];
    expect(appendScreenshots(current, ["second", "third"])).toEqual(["first", "second", "third"]);
    expect(current).toEqual(["first"]);
    expect(appendScreenshots(current, ["second", "third", "fourth"])).toHaveLength(4);
  });
  it("rejects excessive count and total size without changing the existing attachments", () => {
    const current = ["first"];
    expect(() => appendScreenshots(current, ["2", "3", "4", "5"])).toThrow("image-count-limit");
    expect(() => appendScreenshots(current, ["x".repeat(1200000)])).toThrow("image-total-limit");
    expect(current).toEqual(["first"]);
  });
});

describe("preview feedback", () => {
  it("ignores messages from a replaced document even within the same artifact", () => {
    const current = { projectId: "game", documentId: "second" };
    expect(isCurrentPreviewMessage({ projectId: "game", documentId: "first" }, current)).toBe(false);
    expect(isCurrentPreviewMessage(current, current)).toBe(true);
  });
  it("binds a snapshot to exact source including manual edits", async () => {
    expect(await hashArtifact("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hashArtifact("abc\n")).not.toBe(await hashArtifact("abc"));
  });
  it("omits excessive or non-serializable state instead of truncating JSON", () => {
    expect(snapshotState({ seed: 42 })).toBe('{"seed":42}');
    expect(snapshotState({ huge: "x".repeat(12000) })).toBeUndefined();
    expect(snapshotState(undefined)).toBeUndefined();
    const circular: { self?: unknown } = {}; circular.self = circular;
    expect(snapshotState(circular)).toBeUndefined();
  });
});
