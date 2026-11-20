import { describe, expect, it } from "vitest";
import {
  formatDuration, matchesActivity, normalizePath, parseDevice, sectionOf, summarizeActivity,
} from "./activity";
import type { ActivitySession } from "./types";

describe("sectionOf", () => {
  it("reconoce la sección de cada ruta", () => {
    expect(sectionOf("/")).toBe("inicio");
    expect(sectionOf("/listas")).toBe("listas");
    expect(sectionOf("/listas/abc")).toBe("listas");
    expect(sectionOf("/chat/42")).toBe("chat");
    expect(sectionOf("/cuenta/privacidad")).toBe("cuenta");
    expect(sectionOf("/super/auditoria")).toBe("super");
    expect(sectionOf("/despedida")).toBe("para-ti");
    expect(sectionOf("/algo-raro")).toBe("otra");
  });
});

describe("normalizePath", () => {
  it("quita parámetros y ancla", () => {
    expect(normalizePath("/listas?x=1#top")).toBe("/listas");
  });
  it("cambia los identificadores por :id", () => {
    expect(normalizePath("/listas/9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f")).toBe("/listas/:id");
    expect(normalizePath("/dedicatorias/123")).toBe("/dedicatorias/:id");
  });
  it("el chat nunca revela la conversación", () => {
    expect(normalizePath("/chat/5")).toBe("/chat");
    expect(normalizePath("/chat/abc-def")).toBe("/chat");
  });
  it("quita la barra final", () => {
    expect(normalizePath("/listas/")).toBe("/listas");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("parseDevice", () => {
  it("detecta iPhone", () => {
    const d = parseDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari");
    expect(d).toMatchObject({ kind: "phone", os: "iOS", browser: "Safari" });
  });
  it("detecta Android con Chrome", () => {
    const d = parseDevice("Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit Chrome/120 Mobile Safari");
    expect(d).toMatchObject({ kind: "phone", os: "Android", browser: "Chrome" });
  });
  it("detecta computador con Edge", () => {
    const d = parseDevice("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 Safari Edg/120");
    expect(d).toMatchObject({ kind: "computer", os: "Windows", browser: "Edge" });
  });
  it("reconoce el iPad que se hace pasar por Mac", () => {
    const d = parseDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari", { touchPoints: 5 });
    expect(d.kind).toBe("tablet");
    expect(d.os).toBe("iOS");
  });
  it("marca la app instalada", () => {
    expect(parseDevice("x", { installed: true }).installed).toBe(true);
    expect(parseDevice("x").installed).toBe(false);
  });
});

describe("matchesActivity", () => {
  const item = { userId: "u1", startedAt: "2026-11-10T12:00:00.000Z" };
  it("filtra por persona", () => {
    expect(matchesActivity(item, { userId: "u1" })).toBe(true);
    expect(matchesActivity(item, { userId: "u2" })).toBe(false);
  });
  it("filtra por rango de fechas", () => {
    expect(matchesActivity(item, { from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z" })).toBe(true);
    expect(matchesActivity(item, { from: "2026-11-11T00:00:00.000Z" })).toBe(false);
    expect(matchesActivity(item, { to: "2026-11-10T12:00:00.000Z" })).toBe(false); // "to" es excluido
  });
});

describe("summarizeActivity", () => {
  const sessions: ActivitySession[] = [
    { id: "s1", userId: "u1", startedAt: "2026-11-10T12:00:00.000Z", lastSeenAt: "2026-11-10T12:10:00.000Z", device: { kind: "phone", os: "iOS", browser: "Safari", installed: false }, activeSeconds: 600, pages: 3 },
    { id: "s2", userId: "u1", startedAt: "2026-11-11T09:00:00.000Z", lastSeenAt: "2026-11-11T09:05:00.000Z", device: { kind: "computer", os: "Windows", browser: "Chrome", installed: false }, activeSeconds: 300, pages: 2 },
  ];
  const views = [
    { section: "chat" as const, seconds: 500 },
    { section: "listas" as const, seconds: 250 },
    { section: "chat" as const, seconds: 150 },
  ];
  it("suma visitas, tiempo y promedio", () => {
    const s = summarizeActivity(sessions, views);
    expect(s.sessions).toBe(2);
    expect(s.activeSeconds).toBe(900);
    expect(s.averageSeconds).toBe(450);
    expect(s.lastSeenAt).toBe("2026-11-11T09:05:00.000Z");
  });
  it("ordena las secciones de más a menos tiempo", () => {
    const s = summarizeActivity(sessions, views);
    expect(s.bySection.map((x) => x.section)).toEqual(["chat", "listas"]);
    expect(s.bySection[0]).toMatchObject({ section: "chat", seconds: 650, views: 2 });
  });
  it("sin visitas, promedio 0 y sin última vez", () => {
    expect(summarizeActivity([], [])).toMatchObject({ sessions: 0, averageSeconds: 0, lastSeenAt: null, bySection: [] });
  });
});

describe("formatDuration", () => {
  it("segundos, minutos y horas", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(90)).toBe("1 min");
    expect(formatDuration(3900)).toBe("1 h 05 min");
  });
});
