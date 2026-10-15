import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeRedirect";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/panel/fotos")).toBe("/panel/fotos");
    expect(safeNextPath("/chat?x=1#y")).toBe("/chat?x=1#y");
  });

  it("rechaza destinos externos o raros", () => {
    for (const bad of ["https://malo.com", "//malo.com", "/\\malo.com", "javascript:alert(1)", "panel", "/a\nb", "", null]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
