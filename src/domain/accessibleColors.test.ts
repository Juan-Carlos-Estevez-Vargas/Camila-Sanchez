import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/core/validation";
import { DEFAULT_THEME } from "./defaults";
import { DARK_NEUTRALS, ensureContrast, mix, readableColors, TEXT_MIN, UI_MIN } from "./accessibleColors";
import { applyPalette, PALETTES } from "./palettes";

describe("contraste accesible", () => {
  it("mezcla colores como color-mix", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#b0305a", "#ffffff", 0)).toBe("#b0305a");
  });

  it("no toca un color que ya contrasta", () => {
    expect(ensureContrast("#2B1720", ["#ffffff"], TEXT_MIN)).toBe("#2b1720");
  });

  it("oscurece o aclara lo justo para llegar al mínimo", () => {
    const light = ensureContrast("#ffb3c6", ["#ffffff"], TEXT_MIN);
    expect(contrastRatio(light, "#ffffff")).toBeGreaterThanOrEqual(TEXT_MIN);
    const dark = ensureContrast("#3a1020", ["#15111a"], TEXT_MIN);
    expect(contrastRatio(dark, "#15111a")).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("las paletas listas no cambian en modo claro", () => {
    for (const palette of PALETTES.filter((p) => p.id !== "medianoche")) {
      const theme = applyPalette(DEFAULT_THEME, palette.colors);
      const readable = readableColors(theme, false);
      expect(readable.text).toBe(palette.colors.text.toLowerCase());
      expect(readable.primaryContrast).toBe(palette.colors.primaryContrast.toLowerCase());
    }
  });

  it("colores elegidos a mano siempre se pueden leer", () => {
    const theme = { ...DEFAULT_THEME, primary: "#ffc0cb", primaryContrast: "#ffffff", background: "#fff0f5", surface: "#ffffff", text: "#ff99aa", muted: "#ffccdd" };
    for (const dark of [false, true]) {
      const r = readableColors(theme, dark);
      const bgs = dark ? [DARK_NEUTRALS.background, DARK_NEUTRALS.surface] : [theme.background, theme.surface];
      for (const bg of bgs) {
        expect(contrastRatio(r.text, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrastRatio(r.muted, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrastRatio(r.link, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrastRatio(r.focus, bg)).toBeGreaterThanOrEqual(UI_MIN);
      }
      expect(contrastRatio(r.primaryContrast, theme.primary)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });
});
