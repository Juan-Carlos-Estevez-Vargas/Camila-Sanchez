import { describe, expect, it } from "vitest";
import { downscaleSteps, fitWithin, formatBytes, isLowResolution, nextQuality, sharpenAmount } from "./sizing";
import { sharpenPixels } from "./optimize";

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

describe("calidad", () => {
  it("busca la calidad por mitades hasta que la diferencia ya no se nota", () => {
    expect(nextQuality(0.8, 0.92)).toBe(0.86);
    expect(nextQuality(0.86, 0.92)).toBe(0.89);
    expect(nextQuality(0.9, 0.91)).toBeNull();
  });
});

describe("nitidez", () => {
  it("no enfoca si la foto casi no se achicó y enfoca más cuanto más se redujo", () => {
    expect(sharpenAmount(2000, 2048)).toBe(0);
    expect(sharpenAmount(2300, 2048)).toBe(0);
    const half = sharpenAmount(4096, 2048);
    const eighth = sharpenAmount(4096, 512);
    expect(half).toBeGreaterThan(0);
    expect(eighth).toBeGreaterThan(half);
    expect(eighth).toBeLessThanOrEqual(0.5);
  });

  it("realza los bordes y deja quietas las zonas lisas", () => {
    // 5×3 píxeles: mitad oscura, mitad clara (un borde vertical en el medio).
    const width = 5;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = x < 2 ? 60 : x === 2 ? 120 : 180;
        data.set([v, v, v, 255], (y * width + x) * 4);
      }
    }
    const before = data.slice();
    sharpenPixels(data, width, height, 0.5);
    const at = (x: number, y: number) => data[(y * width + x) * 4]!;
    expect(at(1, 1)).toBeLessThan(before[(1 * width + 1) * 4]!); // el lado oscuro del borde, más oscuro
    expect(at(3, 1)).toBeGreaterThan(before[(1 * width + 3) * 4]!); // el claro, más claro
    expect(at(0, 1)).toBe(60); // zona lisa: igual
    expect(data[3]).toBe(255); // la transparencia no se toca
  });
});

describe("baja resolución", () => {
  it("avisa cuando la foto es pequeña para verla en grande", () => {
    expect(isLowResolution(800, 600)).toBe(true);
    expect(isLowResolution(1600, 1200)).toBe(false);
    expect(isLowResolution(null, null)).toBe(false);
    // En la foto de perfil (máx. 640 px) una de 700 px está bien.
    expect(isLowResolution(700, 700, 640)).toBe(false);
  });
});

it("formatea bytes", () => {
  expect(formatBytes(2_500_000)).toBe("2.4 MB");
  expect(formatBytes(300 * 1024)).toBe("300 KB");
});
