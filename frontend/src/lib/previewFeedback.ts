import type { PreviewFeedback } from "@/types";

export async function hashArtifact(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function snapshotState(state: unknown): string | undefined {
  if (state === undefined) return undefined;
  try {
    const text = JSON.stringify(state);
    return text.length <= 12000 ? text : undefined;
  } catch { return undefined; }
}

export function isCurrentPreviewMessage(data: { projectId?: string; documentId?: string }, document: { projectId: string; documentId: string }): boolean {
  return data.projectId === document.projectId && data.documentId === document.documentId;
}

export async function createPreviewFeedback(code: string, viewport: PreviewFeedback["viewport"], state?: unknown, error?: string): Promise<PreviewFeedback> {
  const stateJson = snapshotState(state);
  return { codeHash: await hashArtifact(code), capturedAt: new Date().toISOString(), viewport,
    ...(error ? { error: error.slice(0, 2000) } : {}), ...(stateJson !== undefined ? { stateJson } : {}) };
}

// Resizing bounds both provider cost and request size. Screenshots remain in memory.
export async function prepareScreenshot(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("invalid-image");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid-image");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (dataUrl.length > 700000) throw new Error("image-too-large");
    return dataUrl;
  } finally { bitmap.close(); }
}
