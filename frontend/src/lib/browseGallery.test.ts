import { describe, expect, it } from "vitest";
import { browseGalleryReducer, initialBrowseGalleryState } from "./browseGallery";
import type { PublicArtifactCard } from "@/types";

const artifact = (shareId: string): PublicArtifactCard => ({ shareId, projectName: shareId, artifactType: "website", updatedAt: "2026-10-10T12:00:00Z" });
const firstPage = () => browseGalleryReducer(initialBrowseGalleryState, { type: "loaded", page: 1, artifacts: [artifact("AAAA"), artifact("BBBB")], hasMore: true });

describe("infinite Browse gallery", () => {
  it("appends pages without dropping earlier creations or duplicating overlapping results", () => {
    const loading = browseGalleryReducer(firstPage(), { type: "loadMore" });
    expect(loading.artifacts.map((item) => item.shareId)).toEqual(["AAAA", "BBBB"]);
    const loaded = browseGalleryReducer(loading, { type: "loaded", page: 2, artifacts: [artifact("BBBB"), artifact("CCCC")], hasMore: false });
    expect(loaded.artifacts.map((item) => item.shareId)).toEqual(["AAAA", "BBBB", "CCCC"]);
    expect(browseGalleryReducer(loaded, { type: "loadMore" })).toBe(loaded);
  });

  it("ignores repeated scroll triggers during a request and responses for older pages", () => {
    const loading = browseGalleryReducer(firstPage(), { type: "loadMore" });
    expect(loading.page).toBe(2);
    expect(browseGalleryReducer(loading, { type: "loadMore" })).toBe(loading);
    expect(browseGalleryReducer(loading, { type: "loaded", page: 1, artifacts: [], hasMore: false })).toBe(loading);
  });

  it("keeps loaded creations on failure and retries the failed page instead of skipping it", () => {
    const loading = browseGalleryReducer(firstPage(), { type: "loadMore" });
    const failed = browseGalleryReducer(loading, { type: "failed", page: 2, disabled: false });
    expect(failed.artifacts).toEqual(firstPage().artifacts);
    expect(browseGalleryReducer(failed, { type: "loadMore" })).toBe(failed);
    const retry = browseGalleryReducer(failed, { type: "retry" });
    expect(retry).toMatchObject({ page: 2, status: "loading" });
    expect(browseGalleryReducer(retry, { type: "loaded", page: 2, artifacts: [artifact("CCCC")], hasMore: false }).artifacts).toHaveLength(3);
  });

  it("retries the first page and clears the gallery if Browse is disabled during scrolling", () => {
    const failed = browseGalleryReducer(initialBrowseGalleryState, { type: "failed", page: 1, disabled: false });
    expect(browseGalleryReducer(failed, { type: "retry" })).toMatchObject({ page: 1, status: "loading" });
    const loading = browseGalleryReducer(firstPage(), { type: "loadMore" });
    const disabled = browseGalleryReducer(loading, { type: "failed", page: 2, disabled: true });
    expect(disabled).toMatchObject({ artifacts: [], hasMore: false, status: "disabled" });
    expect(browseGalleryReducer(disabled, { type: "loadMore" })).toBe(disabled);
  });
});
