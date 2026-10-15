import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/core/validation";
import { DEFAULT_THEME } from "./defaults";
import { applyPalette, changesBeyondPalette, matchPalette, PALETTES, V1_PALETTE } from "./palettes";

describe("paletas", () => {
  it("el tema de fábrica usa la paleta suave de la versión 1 en modo claro", () => {
    expect(matchPalette(DEFAULT_THEME)?.id).toBe(V1_PALETTE.id);
    expect(DEFAULT_THEME.background).toBe("#ffe6ec");
    expect(DEFAULT_THEME.darkMode).toBe("light");
  });

  it.each(PALETTES.map((p) => [p.name, p] as const))("%s se lee bien", (_name, palette) => {
    const c = palette.colors;
    expect(contrastRatio(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.muted, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.primaryContrast, c.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("aplicar una paleta sólo cambia colores", () => {
    const custom = { ...DEFAULT_THEME, fontDisplay: "Lora", radius: 6 };
    const lavanda = PALETTES.find((p) => p.id === "lavanda")!;
    const next = applyPalette(custom, lavanda.colors);
    expect(next.fontDisplay).toBe("Lora");
    expect(next.radius).toBe(6);
    expect(matchPalette(next)?.id).toBe("lavanda");
    expect(changesBeyondPalette(custom, next)).toBe(false);
    expect(changesBeyondPalette(custom, { ...next, radius: 10 })).toBe(true);
  });

  it("colores sueltos no coinciden con ninguna paleta", () => {
    expect(matchPalette({ ...DEFAULT_THEME, accent: "#123456" })).toBeNull();
  });
});
