import { describe, expect, it } from "vitest";
import { getArtifactSource, getOwnedArtifactVersionId, planWorkspaceEdit, resolveArtifactLibraryEntry } from "./artifactLibrary";

describe("Artifact Library", () => {
  it("reconnects only the selected owned creation after authentication", () => {
    const saved = [{ id: "custom-1", name: "Saved", code: "manual edits", currentVersionId: "older", createdAt: 1, updatedAt: 1 }];
    const versions = [{ id: "older" }, { id: "latest-unrelated" }];
    expect(getOwnedArtifactVersionId("custom-1", saved, versions)).toBe("older");
    expect(getOwnedArtifactVersionId("shared-1", saved, versions)).toBeNull();
    expect(getOwnedArtifactVersionId("starter", saved, versions)).toBeNull();
    expect(getOwnedArtifactVersionId("custom-1", saved, [{ id: "other-owner" }])).toBeNull();
    expect(saved[0].code).toBe("manual edits");
  });
  it("classifies existing storage identifiers without migrating them eagerly", () => {
    expect(getArtifactSource("landing-page")).toBe("starter");
    expect(getArtifactSource("custom-123")).toBe("saved");
    expect(getArtifactSource("shared-123")).toBe("shared");
  });

  it("resolves each source into one workspace shape", () => {
    const options = {
      savedArtifacts: [{ id: "custom-1", name: "Saved", code: "saved", artifactType: "game" as const, currentVersionId: "v1", createdAt: 1, updatedAt: 1 }],
      sharedArtifacts: [{ id: "shared-1", shareId: "ABCD", code: "shared", title: "Shared", loadedAt: 1 }],
      getStarter: (id: string) => (id === "starter-1" ? { id, code: "starter", artifactType: "website" as const } : undefined),
    };

    expect(resolveArtifactLibraryEntry("custom-1", options)).toMatchObject({ source: "saved", currentVersionId: "v1" });
    expect(resolveArtifactLibraryEntry("shared-1", options)).toMatchObject({ source: "shared", currentVersionId: null });
    expect(resolveArtifactLibraryEntry("starter-1", options)).toMatchObject({ source: "starter", currentVersionId: null });
  });

  it("forks immutable sources once and updates saved artifacts thereafter", () => {
    expect(planWorkspaceEdit({ source: "starter", code: "before" }, "after").action).toBe("fork-to-saved");
    expect(planWorkspaceEdit({ source: "shared", code: "before" }, "after").action).toBe("fork-to-saved");
    expect(planWorkspaceEdit({ source: "saved", code: "before" }, "after").action).toBe("update-saved");
    expect(planWorkspaceEdit({ source: "saved", code: "same" }, "same").action).toBe("none");
  });
});
