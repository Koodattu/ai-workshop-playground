import { afterEach, describe, expect, it, vi } from "vitest";
import { getGenerationClientContext } from "./generationClientContext";

afterEach(() => vi.unstubAllGlobals());

function browser(width: number, height: number, touch: number, pointer: boolean, hover: boolean) {
  const client = {
    innerWidth: width, innerHeight: height, navigator: { maxTouchPoints: touch },
    matchMedia: (query: string) => ({ matches: query === "(any-pointer: fine)" ? pointer : hover }),
  };
  vi.stubGlobal("window", client);
  return client;
}

describe("generation client hints", () => {
  it("does not confuse a narrow desktop preview with a touch device", () => {
    browser(1440, 900, 0, true, true);
    expect(getGenerationClientContext({ width: 360, height: 650 })).toEqual({
      viewport: { width: 1440, height: 900 }, previewViewport: { width: 360, height: 650 },
      touch: false, finePointer: true, hover: true,
    });
  });

  it("captures touch-only and hybrid capabilities without forcing a device label", () => {
    browser(390, 844, 5, false, false);
    expect(getGenerationClientContext()).toMatchObject({ touch: true, finePointer: false, hover: false });
    browser(1024, 768, 5, true, true);
    expect(getGenerationClientContext()).toMatchObject({ touch: true, finePointer: true, hover: true });
  });

  it("samples current dimensions each time and omits an unmounted or hidden preview", () => {
    const client = browser(390, 844, 5, false, false);
    expect(getGenerationClientContext({ width: 0, height: 0 })).not.toHaveProperty("previewViewport");
    client.innerWidth = 844; client.innerHeight = 390;
    expect(getGenerationClientContext()?.viewport).toEqual({ width: 844, height: 390 });
  });

  it("stays optional during server rendering and bounds unusual dimensions", () => {
    vi.stubGlobal("window", undefined);
    expect(getGenerationClientContext()).toBeUndefined();
    browser(20000, 0, 0, false, false);
    expect(getGenerationClientContext()?.viewport).toEqual({ width: 16384, height: 1 });
  });
});
