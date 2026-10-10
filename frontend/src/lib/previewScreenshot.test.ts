import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePreviewScreenshot } from "./previewScreenshot";
import { prepareScreenshot } from "./previewFeedback";

vi.mock("./previewFeedback", () => ({ prepareScreenshot: vi.fn(async () => "data:image/jpeg;base64,cHJldmlldw==") }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

function setup() {
  const events: string[] = [];
  const target = {};
  const element = { isConnected: true, getBoundingClientRect: () => ({ width: 640, height: 360, top: 10, left: 10, bottom: 370, right: 650 }) } as HTMLElement;
  const track = Object.assign(new EventTarget(), {
    cropTo: vi.fn(async () => { events.push("crop"); }),
    getSettings: () => ({ displaySurface: "browser" }),
    readyState: "live",
    stop: vi.fn(() => { events.push("stop"); }),
  });
  const audio = { stop: vi.fn() };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track, audio] };
  const getDisplayMedia = vi.fn(async () => { events.push("picker"); return stream; });
  let frameCallback: (() => void) | undefined;
  const video = Object.assign(new EventTarget(), {
    srcObject: null, videoWidth: 2560, videoHeight: 1440, muted: false, playsInline: false,
    requestVideoFrameCallback: vi.fn((callback: () => void) => { frameCallback = callback; return 1; }),
    cancelVideoFrameCallback: vi.fn(),
    play: vi.fn(async () => { events.push("frame"); frameCallback?.(); }),
    pause: vi.fn(),
  });
  const drawImage = vi.fn(() => { events.push("draw"); });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["pixels"], { type: "image/png" })) };
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800, CropTarget: { fromElement: vi.fn(async () => target) } });
  vi.stubGlobal("HTMLVideoElement", { prototype: { requestVideoFrameCallback: () => {} } });
  vi.stubGlobal("document", { createElement: (tag: string) => tag === "video" ? video : canvas });
  return { element, target, track, audio, video, canvas, drawImage, getDisplayMedia, events };
}

describe("exact preview screenshots", () => {
  it("crops before reading pixels, bounds image size, and releases every track before preparing the attachment", async () => {
    const f = setup();
    const capture = capturePreviewScreenshot(f.element);
    expect(f.getDisplayMedia).toHaveBeenCalledOnce(); // still in the click's activation
    expect(await capture).toBe("data:image/jpeg;base64,cHJldmlldw==");
    expect(f.getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, preferCurrentTab: true, monitorTypeSurfaces: "exclude" }));
    expect(f.track.cropTo).toHaveBeenCalledWith(f.target);
    expect(f.events.slice(0, 5)).toEqual(["picker", "crop", "frame", "draw", "stop"]);
    expect(f.drawImage).toHaveBeenCalledWith(f.video, 0, 0, 1280, 720);
    expect(prepareScreenshot).toHaveBeenCalledWith(expect.any(File));
    expect(f.audio.stop).toHaveBeenCalled();
    expect(f.video.srcObject).toBeNull();
  });

  it("treats cancelling the picker as no new attachment", async () => {
    const f = setup();
    f.getDisplayMedia.mockRejectedValueOnce(new DOMException("Cancelled", "NotAllowedError"));
    expect(await capturePreviewScreenshot(f.element)).toBeNull();
    expect(prepareScreenshot).not.toHaveBeenCalled();
  });

  it.each(["monitor", "window"])("rejects a selected %s and stops sharing without copying pixels", async (displaySurface) => {
    const f = setup();
    f.track.getSettings = () => ({ displaySurface });
    await expect(capturePreviewScreenshot(f.element)).rejects.toThrow("capture-current-tab");
    expect(f.drawImage).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalled();
  });

  it("does not fall back to an uncropped screenshot when another tab cannot crop to this preview", async () => {
    const f = setup();
    f.track.cropTo.mockRejectedValueOnce(new Error("Different tab"));
    await expect(capturePreviewScreenshot(f.element)).rejects.toThrow("capture-current-tab");
    expect(f.drawImage).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalled();
  });

  it("stops sharing if the preview was removed while the picker was open", async () => {
    const f = setup();
    const capture = capturePreviewScreenshot(f.element);
    Object.defineProperty(f.element, "isConnected", { value: false });
    await expect(capture).rejects.toThrow("preview-unavailable");
    expect(f.track.stop).toHaveBeenCalled();
    expect(f.drawImage).not.toHaveBeenCalled();
  });

  it("times out and releases tracks if no video frame arrives", async () => {
    vi.useFakeTimers();
    const f = setup();
    f.video.play.mockResolvedValueOnce(undefined);
    const result = expect(capturePreviewScreenshot(f.element)).rejects.toThrow("capture-failed");
    await vi.advanceTimersByTimeAsync(5000);
    await result;
    expect(f.track.stop).toHaveBeenCalled();
    expect(f.drawImage).not.toHaveBeenCalled();
    expect(f.video.cancelVideoFrameCallback).toHaveBeenCalled();
  });

  it("does not open the picker for a hidden preview or unsupported browser", async () => {
    const f = setup();
    f.element.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    await expect(capturePreviewScreenshot(f.element)).rejects.toThrow("preview-unavailable");
    vi.stubGlobal("window", {});
    await expect(capturePreviewScreenshot(f.element)).rejects.toThrow("capture-unsupported");
    expect(f.getDisplayMedia).not.toHaveBeenCalled();
  });
});
