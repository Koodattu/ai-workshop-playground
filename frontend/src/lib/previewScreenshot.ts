import { prepareScreenshot } from "./previewFeedback";

type RegionCaptureTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };
type CaptureWindow = Window & { CropTarget?: { fromElement: (element: HTMLElement) => Promise<unknown> } };

function requireVisiblePreview(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (!element.isConnected || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
    throw new Error("preview-unavailable");
  }
}

async function readFrame(video: HTMLVideoElement, stream: MediaStream, track: MediaStreamTrack): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      video.cancelVideoFrameCallback(frame);
      track.removeEventListener("ended", ended);
      video.removeEventListener("error", failed);
      if (error) reject(error); else resolve();
    };
    const failed = () => finish(new Error("capture-failed"));
    const ended = () => finish(new Error("capture-ended"));
    const timeout = setTimeout(failed, 5000);
    track.addEventListener("ended", ended, { once: true });
    video.addEventListener("error", failed, { once: true });
    const frame = video.requestVideoFrameCallback(() => finish());
    video.srcObject = stream;
    void video.play().catch(failed);
  });
}

// Region Capture validates the selected tab against this element. Never fall
// back to attaching an uncropped tab, window, or desktop on capture failure.
export async function capturePreviewScreenshot(element: HTMLElement): Promise<string | null> {
  const cropTarget = (window as CaptureWindow).CropTarget;
  if (!navigator.mediaDevices?.getDisplayMedia || !cropTarget?.fromElement || !HTMLVideoElement.prototype.requestVideoFrameCallback) {
    throw new Error("capture-unsupported");
  }
  requireVisiblePreview(element);

  let stream: MediaStream;
  try {
    // Keep this before any await so the browser receives the camera click's activation.
    const options = {
      video: { displaySurface: "browser" }, audio: false,
      preferCurrentTab: true, selfBrowserSurface: "include",
      monitorTypeSurfaces: "exclude", surfaceSwitching: "exclude",
    };
    stream = await navigator.mediaDevices.getDisplayMedia(options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") return null;
    throw error;
  }

  const video = document.createElement("video");
  try {
    requireVisiblePreview(element);
    const track = stream.getVideoTracks()[0] as RegionCaptureTrack | undefined;
    if (!track?.cropTo || track.getSettings().displaySurface !== "browser") throw new Error("capture-current-tab");
    const target = await cropTarget.fromElement(element);
    try { await track.cropTo(target); }
    catch { throw new Error("capture-current-tab"); }
    video.muted = true;
    video.playsInline = true;
    await readFrame(video, stream, track);
    requireVisiblePreview(element);
    if (!video.videoWidth || !video.videoHeight || track.readyState === "ended") throw new Error("capture-failed");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("capture-failed");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Stop sharing as soon as pixels have been copied, before image processing.
    stream.getTracks().forEach((item) => item.stop());
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("capture-failed")), "image/png"));
    return await prepareScreenshot(new File([blob], "preview.png", { type: "image/png" }));
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
  }
}
