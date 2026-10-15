import { describe, expect, it } from "vitest";
import { buildCountdowns, elapsedSince, groupPhotosByYearMonth, nextOccurrence } from "./dates";
import type { ImportantDate, Photo } from "./types";

const date = (over: Partial<ImportantDate>): ImportantDate => ({
  id: "x", title: "Tu cumpleaños", eventDate: "2000-04-20", recursYearly: true,
  icon: "🎂", message: "", isVisible: true, ...over,
});

describe("nextOccurrence", () => {
  it("devuelve la fecha de este año si aún no pasa", () => {
    expect(nextOccurrence(date({}), new Date(2026, 0, 10))).toEqual(new Date(2026, 3, 20));
  });
  it("salta al año siguiente si ya pasó", () => {
    expect(nextOccurrence(date({}), new Date(2026, 5, 1))).toEqual(new Date(2027, 3, 20));
  });
  it("el mismo día cuenta como hoy", () => {
    expect(nextOccurrence(date({}), new Date(2026, 3, 20, 18))).toEqual(new Date(2026, 3, 20));
  });
  it("mueve el 29 de febrero al 28 en años no bisiestos", () => {
    expect(nextOccurrence(date({ eventDate: "2024-02-29" }), new Date(2026, 0, 1))).toEqual(new Date(2026, 1, 28));
  });
  it("una fecha única que ya pasó no tiene próxima ocurrencia", () => {
    expect(nextOccurrence(date({ recursYearly: false, eventDate: "2025-01-01" }), new Date(2026, 0, 1))).toBeNull();
  });
});

describe("buildCountdowns", () => {
  it("ordena por cercanía, oculta invisibles y calcula años", () => {
    const now = new Date(2026, 4, 1);
    const result = buildCountdowns([
      date({ id: "a", title: "Navidad", eventDate: "2025-12-24" }),
      date({ id: "b", title: "Aniversario", eventDate: "2025-05-31" }),
      date({ id: "c", isVisible: false }),
    ], now);
    expect(result.map((c) => c.date.id)).toEqual(["b", "a"]);
    expect(result[0]).toMatchObject({ days: 30, years: 1 });
  });
});

describe("elapsedSince", () => {
  it("descompone días, horas, minutos y segundos", () => {
    const start = new Date(2025, 4, 31);
    const now = new Date(2025, 5, 2, 3, 4, 5);
    expect(elapsedSince(start, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });
  it("nunca devuelve negativos", () => {
    expect(elapsedSince(new Date(2030, 0, 1), new Date(2026, 0, 1)).days).toBe(0);
  });
});

describe("groupPhotosByYearMonth", () => {
  const photo = (id: string, takenOn: string, position = 0): Photo => ({
    id, takenOn, position, storagePath: null, thumbPath: null, externalUrl: "/x.jpg",
    caption: "", width: null, height: null, bytes: null, createdAt: "",
  });
  it("agrupa por año (desc) y mes, respetando la posición", () => {
    const groups = groupPhotosByYearMonth([
      photo("a", "2025-06-10", 1), photo("b", "2025-06-10", 0), photo("c", "2026-01-02"),
    ]);
    expect(groups.map((g) => g.year)).toEqual([2026, 2025]);
    expect(groups[1]!.months[5]!.photos.map((p) => p.id)).toEqual(["b", "a"]);
    expect(groups[1]!.months).toHaveLength(12);
    expect(groups[1]!.total).toBe(2);
  });
});
