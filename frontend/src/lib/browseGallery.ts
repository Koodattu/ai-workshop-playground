import type { PublicArtifactCard } from "@/types";

export interface BrowseGalleryState {
  artifacts: PublicArtifactCard[];
  page: number;
  hasMore: boolean;
  status: "loading" | "ready" | "error" | "disabled";
}

export const initialBrowseGalleryState: BrowseGalleryState = {
  artifacts: [], page: 1, hasMore: true, status: "loading",
};

type BrowseGalleryAction =
  | { type: "loadMore" }
  | { type: "retry" }
  | { type: "loaded"; page: number; artifacts: PublicArtifactCard[]; hasMore: boolean }
  | { type: "failed"; page: number; disabled: boolean };

export function browseGalleryReducer(state: BrowseGalleryState, action: BrowseGalleryAction): BrowseGalleryState {
  if (action.type === "loadMore") {
    return state.status === "ready" && state.hasMore ? { ...state, page: state.page + 1, status: "loading" } : state;
  }
  if (action.type === "retry") {
    return state.status === "error" ? { ...state, status: "loading" } : state;
  }
  if (action.page !== state.page || state.status !== "loading") return state;
  if (action.type === "failed") {
    return action.disabled
      ? { ...state, artifacts: [], hasMore: false, status: "disabled" }
      : { ...state, status: "error" };
  }

  // Offset pages can overlap if another creation is published while scrolling.
  const artifacts = new Map(state.artifacts.map((artifact) => [artifact.shareId, artifact]));
  action.artifacts.forEach((artifact) => artifacts.set(artifact.shareId, artifact));
  return { ...state, artifacts: [...artifacts.values()], hasMore: action.hasMore, status: "ready" };
}
