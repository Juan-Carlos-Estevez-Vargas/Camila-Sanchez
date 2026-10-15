import { describe, expect, it } from "vitest";
import { contrastRatio, isSafeUrl, safeColor, safeFontFamily } from "./validation";

describe("validation", () => {
  it("rechaza colores que no son hex", () => {
    expect(safeColor("#b0305a", "#000")).toBe("#b0305a");
    expect(safeColor("red; background:url(javascript:alert(1))", "#000")).toBe("#000");
  });
  it("sólo acepta fuentes con caracteres seguros", () => {
    expect(safeFontFamily("Playfair Display", "x")).toBe("Playfair Display");
    expect(safeFontFamily("x'; } body { display:none", "Inter")).toBe("Inter");
  });
  it("sólo acepta https o rutas propias", () => {
    expect(isSafeUrl("https://example.com/a.mp3")).toBe(true);
    expect(isSafeUrl("/assets/img/a.jpg")).toBe(true);
    expect(isSafeUrl("//evil.com/a.js")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("http://inseguro.com")).toBe(false);
  });
  it("calcula contraste WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#fff", "#fff")).toBeCloseTo(1, 5);
  });
});
