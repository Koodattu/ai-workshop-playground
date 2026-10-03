import type { ArtifactType, SavedArtifact, SharedArtifact } from "../types";
import { CUSTOM_TEMPLATE_CONFIG, SHARED_TEMPLATE_CONFIG } from "../types";

export type ArtifactSource = "starter" | "saved" | "shared";

export interface WorkspaceArtifact {
  id: string;
  source: ArtifactSource;
  code: string;
  artifactType: ArtifactType;
  projectName?: string;
  currentVersionId: string | null;
}

interface ResolveArtifactLibraryEntryOptions {
  savedArtifacts: SavedArtifact[];
  sharedArtifacts: SharedArtifact[];
  getStarter: (id: string) => Omit<WorkspaceArtifact, "source" | "currentVersionId"> | undefined;
}

export function getArtifactSource(id: string): ArtifactSource {
  if (id.startsWith(CUSTOM_TEMPLATE_CONFIG.ID_PREFIX)) return "saved";
  if (id.startsWith(SHARED_TEMPLATE_CONFIG.ID_PREFIX)) return "shared";
  return "starter";
}

export const isSavedArtifactId = (id: string) => getArtifactSource(id) === "saved";

export function resolveArtifactLibraryEntry(
  id: string,
  { savedArtifacts, sharedArtifacts, getStarter }: ResolveArtifactLibraryEntryOptions,
): WorkspaceArtifact | undefined {
  const source = getArtifactSource(id);

  if (source === "saved") {
    const artifact = savedArtifacts.find((candidate) => candidate.id === id);
    if (!artifact) return undefined;
    return {
      id: artifact.id,
      source,
      code: artifact.code,
      artifactType: artifact.artifactType || "website",
      projectName: artifact.projectName,
      currentVersionId: artifact.currentVersionId || null,
    };
  }

  if (source === "shared") {
    const artifact = sharedArtifacts.find((candidate) => candidate.id === id);
    if (!artifact) return undefined;
    return {
      id: artifact.id,
      source,
      code: artifact.code,
      artifactType: artifact.artifactType || "website",
      projectName: artifact.projectName,
      currentVersionId: null,
    };
  }

  const starter = getStarter(id);
  return starter ? { ...starter, source, currentVersionId: null } : undefined;
}

export type WorkspaceEditPlan =
  | { action: "none"; code: string }
  | { action: "update-saved"; code: string }
  | { action: "fork-to-saved"; code: string };

export function planWorkspaceEdit(artifact: Pick<WorkspaceArtifact, "source" | "code">, nextCode: string): WorkspaceEditPlan {
  if (nextCode === artifact.code) return { action: "none", code: nextCode };
  return {
    action: artifact.source === "saved" ? "update-saved" : "fork-to-saved",
    code: nextCode,
  };
}
