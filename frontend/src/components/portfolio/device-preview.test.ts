import { describe, expect, it } from "vitest";
import { deviceFor, fitScale, MAX_WIDTH, MIN_WIDTH, previewDevices } from "./device-preview";

describe("responsive preview geometry", () => {
  it("classes widths with the site's own breakpoints", () => {
    expect(deviceFor(MIN_WIDTH)).toBe("mobile");
    expect(deviceFor(639)).toBe("mobile");
    expect(deviceFor(640)).toBe("tablet");
    expect(deviceFor(1023)).toBe("tablet");
    expect(deviceFor(1024)).toBe("desktop");
    expect(deviceFor(MAX_WIDTH)).toBe("desktop");
    for (const [device, size] of Object.entries(previewDevices))
      expect(deviceFor(size.width)).toBe(device);
  });

  it("never draws a frame wider or taller than the stage, nor larger than life", () => {
    for (const { width, height } of Object.values(previewDevices))
      for (const [stage, maxHeight] of [
        [326, 520],
        [900, 560],
        [1600, 900],
      ] as const) {
        const scale = fitScale(width, height, stage, maxHeight);
        expect(scale).toBeLessThanOrEqual(1);
        expect(width * scale).toBeLessThanOrEqual(stage + 1e-9);
        expect(height * scale).toBeLessThanOrEqual(maxHeight + 1e-9);
      }
    expect(fitScale(390, 844, 2000, 2000)).toBe(1);
  });
});
