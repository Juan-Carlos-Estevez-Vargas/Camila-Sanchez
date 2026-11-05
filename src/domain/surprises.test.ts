import { describe, expect, it } from "vitest";
import { isSurpriseFor, isSurpriseLive, isSurpriseReceived } from "./surprises";
import type { Interruption } from "./types";

const base: Interruption = {
  id: "s1", title: "¡Feliz mesiversario!", body: "", style: "hearts",
  startsAt: "2026-01-01T00:00:00Z", endsAt: null, isActive: true, showOnce: true,
  recipientId: "cami", createdBy: "juan",
};

describe("sorpresas", () => {
  it("sólo le sale a la persona elegida", () => {
    expect(isSurpriseFor(base, "cami")).toBe(true);
    expect(isSurpriseFor(base, "juan")).toBe(false);
    expect(isSurpriseFor(base, "otra")).toBe(false);
    expect(isSurpriseFor(base, null)).toBe(false);
  });

  it("nunca le sale a quien la creó, aunque sea antigua (sin destinataria)", () => {
    const old = { ...base, recipientId: null };
    expect(isSurpriseFor(old, "juan")).toBe(false);
    expect(isSurpriseFor(old, "cami")).toBe(true);
    expect(isSurpriseFor(old, undefined)).toBe(false);
  });

  it("respeta la ventana de tiempo", () => {
    const now = Date.parse("2026-06-01T00:00:00Z");
    expect(isSurpriseLive(base, now)).toBe(true);
    expect(isSurpriseLive({ ...base, isActive: false }, now)).toBe(false);
    expect(isSurpriseLive({ ...base, startsAt: "2026-07-01T00:00:00Z" }, now)).toBe(false);
    expect(isSurpriseLive({ ...base, endsAt: "2026-05-01T00:00:00Z" }, now)).toBe(false);
  });

  it("lo recibido se queda guardado aunque venza o ya se haya visto", () => {
    const now = Date.parse("2026-06-01T00:00:00Z");
    const expired = { ...base, endsAt: "2026-05-01T00:00:00Z" };
    expect(isSurpriseReceived(expired, "cami", [], now)).toBe(true);
    expect(isSurpriseReceived(base, "cami", ["s1"], now)).toBe(true);
    // Apagada: sólo se queda si ya la vio.
    expect(isSurpriseReceived({ ...base, isActive: false }, "cami", [], now)).toBe(false);
    expect(isSurpriseReceived({ ...base, isActive: false }, "cami", ["s1"], now)).toBe(true);
    // Lo que aún no empieza, ni a quien la creó.
    expect(isSurpriseReceived({ ...base, startsAt: "2026-07-01T00:00:00Z" }, "cami", [], now)).toBe(false);
    expect(isSurpriseReceived(base, "juan", [], now)).toBe(false);
  });
});
