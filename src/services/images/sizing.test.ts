import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_OPTIONS, downscaleSteps, fitWithin, formatBytes, qualityLadder } from "./sizing";

describe("fitWithin", () => {
  it("reduce manteniendo la proporción", () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });
  it("nunca agranda imágenes pequeñas", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe("downscaleSteps", () => {
  it("reduce a la mitad hasta acercarse al destino", () => {
    expect(downscaleSteps(4000, 480)).toEqual([2000, 1000, 480]);
    expect(downscaleSteps(600, 480)).toEqual([480]);
  });
});

describe("qualityLadder", () => {
  it("baja la calidad sin pasar del mínimo", () => {
    const ladder = qualityLadder(DEFAULT_IMAGE_OPTIONS);
    expect(ladder[0]).toBe(0.84);
    expect(Math.min(...ladder)).toBeGreaterThanOrEqual(DEFAULT_IMAGE_OPTIONS.minQuality);
  });
});

it("formatea bytes", () => {
  expect(formatBytes(2_500_000)).toBe("2.4 MB");
  expect(formatBytes(300 * 1024)).toBe("300 KB");
});
