import { describe, expect, it } from "vitest";
import { normalizePath, sectionOf } from "./activity";
import {
  BOUQUETS, bouquetDayKey, bouquetPath, fillBouquetMessage, isBouquetRecipient, normalizeBouquet,
  normalizeBouquetNote, parseBouquetPath,
} from "./bouquets";
import { SPECIAL_DAY_IDS, bouquetWindowAt, msUntilBouquetChange, normalizeSpecialDays } from "./specialDays";

const CAMI = "22222222-2222-4222-8222-222222222222";
const JUAN = "11111111-1111-4111-8111-111111111111";

describe("ramo de flores", () => {
  it("cada fecha especial tiene su ramo, y el cumpleaños es de gerberas", () => {
    expect(Object.keys(BOUQUETS).sort()).toEqual([...SPECIAL_DAY_IDS].sort());
    expect(BOUQUETS.birthday.flower).toBe("gerbera");
    for (const id of SPECIAL_DAY_IDS) expect(BOUQUETS[id].colors.length).toBeGreaterThanOrEqual(7);
  });

  it("viene encendido y se normaliza sin romperse con datos raros", () => {
    expect(normalizeSpecialDays({}).bouquet).toEqual({ enabled: true, recipientId: null, signature: "", eveHour: 21 });
    expect(normalizeBouquet({ enabled: false, recipientId: "no-es-uuid", signature: "x".repeat(99) }))
      .toEqual({ enabled: false, recipientId: null, signature: "x".repeat(40), eveHour: 21 });
    expect(normalizeBouquet({ recipientId: CAMI }).recipientId).toBe(CAMI);
  });

  it("sale sólo a quien es: la elegida o, si no se eligió, quien no edita la Apariencia", () => {
    const auto = normalizeBouquet({});
    expect(isBouquetRecipient(auto, { userId: CAMI, canManageTheme: false })).toBe(true);
    expect(isBouquetRecipient(auto, { userId: JUAN, canManageTheme: true })).toBe(false);
    expect(isBouquetRecipient(auto, { userId: null, canManageTheme: false })).toBe(false);
    const forCami = normalizeBouquet({ recipientId: CAMI });
    expect(isBouquetRecipient(forCami, { userId: CAMI, canManageTheme: true })).toBe(true);
    expect(isBouquetRecipient(forCami, { userId: JUAN, canManageTheme: false })).toBe(false);
    expect(isBouquetRecipient(normalizeBouquet({ enabled: false }), { userId: CAMI, canManageTheme: false })).toBe(false);
  });

  it("la nota acepta sólo fechas que existen y recorta lo largo", () => {
    expect(normalizeBouquetNote({ dayId: "pascua", place: "x" })).toBeNull();
    expect(normalizeBouquetNote({ dayId: "birthday", place: "p".repeat(100), time: 8, message: "hola" }))
      .toEqual({ dayId: "birthday", place: "p".repeat(80), time: "", message: "hola" });
  });

  it("el mensaje propio cambia {lugar}, {hora} y {nombre}", () => {
    expect(fillBouquetMessage("{nombre}, te espero en {lugar} a las {hora} 😏", { place: "Andrés", time: "8 p. m.", name: "Cami" }))
      .toBe("Cami, te espero en Andrés a las 8 p. m. 😏");
    expect(fillBouquetMessage("Te espero  {hora}", { place: "", time: "", name: "" })).toBe("Te espero");
  });

  it("cada apertura es una página «/ramo/…» de la sección ramo en la actividad", () => {
    const path = bouquetPath("newYear", "boton");
    expect(path).toBe("/ramo/newYear/boton");
    expect(normalizePath(path)).toBe(path);
    expect(sectionOf(path)).toBe("ramo");
    expect(parseBouquetPath(path)).toEqual({ dayId: "newYear", trigger: "boton" });
    expect(parseBouquetPath("/ramo/pascua/auto")).toBeNull();
    expect(parseBouquetPath("/listas/:id")).toBeNull();
  });

  it("se abre solo una vez por día", () => {
    expect(bouquetDayKey("birthday", new Date(2026, 2, 7, 23, 59))).toBe("birthday:2026-03-07");
    expect(bouquetDayKey("birthday", new Date(2026, 2, 8, 0, 1))).toBe("birthday:2026-03-08");
  });

  describe("desde la víspera", () => {
    const config = normalizeSpecialDays({ birthday: "1999-03-07", bouquet: {} });
    const at = (d: Date, c = config) => bouquetWindowAt(c, null, d);

    it("se abre desde el día anterior a las 9 p. m. hasta las 11:59 p. m. del cumpleaños", () => {
      expect(at(new Date(2027, 2, 6, 20, 59))).toBeNull();
      expect(at(new Date(2027, 2, 6, 21, 0))).toMatchObject({ day: { id: "birthday" }, eve: true });
      expect(at(new Date(2027, 2, 7, 0, 0))).toMatchObject({ day: { id: "birthday" }, eve: false });
      expect(at(new Date(2027, 2, 7, 23, 59))).toMatchObject({ day: { id: "birthday" }, eve: false });
      expect(at(new Date(2027, 2, 8, 0, 0))).toBeNull();
    });

    it("se abre solo una vez por fecha: la víspera cuenta como el día", () => {
      const eve = at(new Date(2027, 2, 6, 22, 0))!;
      expect(bouquetDayKey("birthday", eve.date)).toBe("birthday:2027-03-07");
      expect(bouquetDayKey("birthday", at(new Date(2027, 2, 7, 9, 0))!.date)).toBe("birthday:2027-03-07");
    });

    it("sin víspera, sólo el día; y apagado, nunca", () => {
      const midnight = normalizeSpecialDays({ birthday: "1999-03-07", bouquet: { eveHour: null } });
      expect(at(new Date(2027, 2, 6, 23, 0), midnight)).toBeNull();
      expect(at(new Date(2027, 2, 7, 1, 0), midnight)).toMatchObject({ eve: false });
      const off = normalizeSpecialDays({ birthday: "1999-03-07", bouquet: { enabled: false } });
      expect(at(new Date(2027, 2, 7, 12, 0), off)).toBeNull();
    });

    it("una hora que no está en la lista vuelve a las 9 p. m.", () => {
      expect(normalizeBouquet({ eveHour: 3 }).eveHour).toBe(21);
      expect(normalizeBouquet({ eveHour: 22 }).eveHour).toBe(22);
    });

    it("cruza el año: Año Nuevo se abre el 30 de diciembre en la noche", () => {
      expect(at(new Date(2026, 11, 30, 21, 30))).toMatchObject({ day: { id: "newYear" }, eve: true });
    });

    it("vuelve a mirar a la hora de la víspera y a la medianoche", () => {
      expect(msUntilBouquetChange(config, new Date(2027, 2, 6, 20, 0))).toBe(60 * 60 * 1000);
      expect(msUntilBouquetChange(config, new Date(2027, 2, 6, 22, 0))).toBe(2 * 60 * 60 * 1000);
    });
  });
});
