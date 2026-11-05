import { describe, expect, it } from "vitest";
import type { AuditEntry } from "./types";
import { matchesAudit, monthKeyOf, monthRange, recentMonths } from "./audit";
import { pageCount, pageItems } from "./pagination";

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 1, actorId: "u1", action: "UPDATE", tableName: "photos", recordId: null,
  oldData: null, newData: null, createdAt: new Date(2026, 10, 5, 9, 56).toISOString(), ...over,
});

describe("meses", () => {
  it("arma la clave y el rango del mes en hora local", () => {
    expect(monthKeyOf(new Date(2026, 10, 5))).toBe("2026-11");
    const { from, to } = monthRange("2026-11");
    expect(new Date(from)).toEqual(new Date(2026, 10, 1));
    expect(new Date(to)).toEqual(new Date(2026, 11, 1));
  });

  it("diciembre termina el 1 de enero siguiente", () => {
    expect(new Date(monthRange("2026-12").to)).toEqual(new Date(2027, 0, 1));
  });

  it("lista este mes y los anteriores cruzando el año", () => {
    expect(recentMonths(new Date(2026, 1, 15), 4)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
});

describe("paginación", () => {
  it("cuenta páginas y nunca da menos de una", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });

  it("muestra todas cuando son pocas", () => {
    expect(pageItems(0, 1)).toEqual([0]);
    expect(pageItems(1, 4)).toEqual([0, 1, 2, 3]);
  });

  it("salta con … y siempre deja la primera y la última", () => {
    expect(pageItems(9, 20)).toEqual([0, "…", 8, 9, 10, "…", 19]);
    expect(pageItems(0, 20)).toEqual([0, 1, "…", 19]);
    expect(pageItems(19, 20)).toEqual([0, "…", 18, 19]);
  });

  it("no pone … por una sola página escondida", () => {
    expect(pageItems(3, 20)).toEqual([0, 1, 2, 3, 4, "…", 19]);
  });
});

describe("filtros", () => {
  it("filtra por sección, acción, persona y fechas", () => {
    const e = entry({});
    expect(matchesAudit(e, {})).toBe(true);
    expect(matchesAudit(e, { table: "photos", action: "UPDATE", actorId: "u1" })).toBe(true);
    expect(matchesAudit(e, { table: "sections" })).toBe(false);
    expect(matchesAudit(e, { action: "DELETE" })).toBe(false);
    expect(matchesAudit(e, { actorId: "u2" })).toBe(false);
    expect(matchesAudit(e, monthRange("2026-11"))).toBe(true);
    expect(matchesAudit(e, monthRange("2026-10"))).toBe(false);
  });

  it("\"system\" busca los cambios sin persona", () => {
    expect(matchesAudit(entry({ actorId: null }), { actorId: "system" })).toBe(true);
    expect(matchesAudit(entry({}), { actorId: "system" })).toBe(false);
  });
});
