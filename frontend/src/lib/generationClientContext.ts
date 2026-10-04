import type { GenerationClientContext } from "@/types";

// Sample at submission so resizing or attaching a pointer does not leave stale hints.
export function getGenerationClientContext(previewViewport?: GenerationClientContext["previewViewport"]): GenerationClientContext | undefined {
  if (typeof window === "undefined") return undefined;
  const dimension = (value: number) => Math.max(1, Math.min(16384, Math.round(value)));
  return {
    viewport: { width: dimension(window.innerWidth), height: dimension(window.innerHeight) },
    ...(previewViewport && previewViewport.width > 0 && previewViewport.height > 0 ? {
      previewViewport: { width: dimension(previewViewport.width), height: dimension(previewViewport.height) },
    } : {}),
    touch: window.navigator.maxTouchPoints > 0,
    finePointer: window.matchMedia("(any-pointer: fine)").matches,
    hover: window.matchMedia("(any-hover: hover)").matches,
  };
}
