import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/core/validation";
import { DEFAULT_THEME, normalizeEffects } from "./defaults";
import { DEFAULT_DAY_SONGS } from "./specialMusic";
import {
  DEFAULT_SPECIAL_DAYS, SPECIAL_DAY_STYLES, friendshipDay, msUntilMidnight, normalizeSpecialDays, previewSpecialDay,
  specialDayOn, specialTheme, type SpecialDaysConfig,
} from "./specialDays";

const config = (patch: Partial<SpecialDaysConfig> = {}): SpecialDaysConfig => ({ ...DEFAULT_SPECIAL_DAYS, ...patch });
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("specialDayOn", () => {
  it("encuentra las fiestas fijas todo el día", () => {
    expect(specialDayOn(config(), null, at(2026, 10, 31, 0))?.id).toBe("halloween");
    expect(specialDayOn(config(), null, at(2026, 10, 31, 23))?.id).toBe("halloween");
    expect(specialDayOn(config(), null, at(2026, 11, 1, 0))).toBeNull();
    expect(specialDayOn(config(), null, at(2026, 12, 24))?.id).toBe("christmas");
    expect(specialDayOn(config(), null, at(2026, 12, 25))?.id).toBe("christmas");
    expect(specialDayOn(config(), null, at(2026, 12, 31))?.id).toBe("newYear");
    expect(specialDayOn(config(), null, at(2027, 1, 1))?.id).toBe("newYear");
    expect(specialDayOn(config(), null, at(2026, 2, 14))?.id).toBe("valentine");
    expect(specialDayOn(config(), null, at(2026, 11, 9))).toBeNull();
  });

  it("Amor y Amistad es el tercer sábado de septiembre", () => {
    expect(friendshipDay(2026).getDate()).toBe(19);
    expect(friendshipDay(2025).getDate()).toBe(20);
    expect(friendshipDay(2027).getDay()).toBe(6);
    expect(specialDayOn(config(), null, at(2026, 9, 19))?.id).toBe("friendship");
  });

  it("el cumpleaños sólo cuando hay fecha, y gana a cualquier otra", () => {
    expect(specialDayOn(config(), null, at(2026, 10, 31))?.id).toBe("halloween");
    expect(specialDayOn(config({ birthday: "2001-10-31" }), null, at(2026, 10, 31))?.id).toBe("birthday");
    expect(specialDayOn(config({ birthday: "2001-03-15" }), null, at(2027, 3, 15))?.id).toBe("birthday");
  });

  it("el 29 de febrero se celebra el 28 en años no bisiestos", () => {
    expect(specialDayOn(config({ birthday: "2004-02-29" }), null, at(2027, 2, 28))?.id).toBe("birthday");
    expect(specialDayOn(config({ birthday: "2004-02-29" }), null, at(2028, 2, 29))?.id).toBe("birthday");
  });

  it("el aniversario cuenta los años y no sale el mismo día en que empezó", () => {
    expect(specialDayOn(config(), "2025-05-31", at(2025, 5, 31))).toBeNull();
    expect(specialDayOn(config(), "2025-05-31", at(2026, 5, 31))).toMatchObject({ id: "anniversary", years: 1 });
    expect(specialDayOn(config(), "2025-05-31", at(2028, 5, 31))).toMatchObject({ id: "anniversary", years: 3 });
  });

  it("respeta el interruptor general y las fechas apagadas", () => {
    expect(specialDayOn(config({ enabled: false }), null, at(2026, 10, 31))).toBeNull();
    expect(specialDayOn(config({ off: ["halloween"] }), null, at(2026, 10, 31))).toBeNull();
    expect(specialDayOn(config({ birthday: "2001-10-31", off: ["birthday"] }), null, at(2026, 10, 31))?.id).toBe("halloween");
  });
});

describe("normalizeSpecialDays", () => {
  it("lo que falta o no vale vuelve a lo de fábrica", () => {
    expect(normalizeSpecialDays(undefined)).toEqual(DEFAULT_SPECIAL_DAYS);
    expect(normalizeSpecialDays({ birthday: "ayer", off: ["halloween", "nada", "halloween", 3], birthdayName: 5 }))
      .toEqual({ enabled: true, birthday: null, birthdayName: "", off: ["halloween"], music: true, songs: DEFAULT_DAY_SONGS, birthdayMessage: "" });
    expect(normalizeSpecialDays({ enabled: false, birthday: "2001-03-15", birthdayName: "x".repeat(80) }))
      .toMatchObject({ enabled: false, birthday: "2001-03-15", birthdayName: "x".repeat(40) });
  });

  it("viaja dentro de los efectos guardados", () => {
    expect(normalizeEffects({}).specialDays).toEqual(DEFAULT_SPECIAL_DAYS);
    expect(normalizeEffects({ specialDays: { birthday: "2001-03-15" } }).specialDays.birthday).toBe("2001-03-15");
  });
});

describe("specialTheme", () => {
  it("pone los colores del día y conserva tipografías y bordes", () => {
    const theme = specialTheme(DEFAULT_THEME, previewSpecialDay("halloween", null));
    expect(theme.background).toBe(SPECIAL_DAY_STYLES.halloween.colors.background);
    expect(theme.darkMode).toBe("light");
    expect(theme.fontDisplay).toBe(DEFAULT_THEME.fontDisplay);
    expect(theme.radius).toBe(DEFAULT_THEME.radius);
    expect(specialTheme({ ...DEFAULT_THEME, darkMode: "auto" }, previewSpecialDay("christmas", null)).darkMode).toBe("auto");
  });

  it("la vista previa del aniversario dice al menos un año", () => {
    expect(previewSpecialDay("anniversary", "2025-05-31", at(2025, 11, 9)).years).toBe(1);
    expect(previewSpecialDay("anniversary", null).years).toBeNull();
  });
});

describe("msUntilMidnight", () => {
  it("cuenta hasta las 00:00 del día siguiente", () => {
    expect(msUntilMidnight(new Date(2026, 10, 9, 23, 59, 0))).toBe(60_000);
  });
});

describe("SPECIAL_DAY_STYLES", () => {
  it("todas las paletas se leen bien (AA)", () => {
    for (const [id, style] of Object.entries(SPECIAL_DAY_STYLES)) {
      const c = style.colors;
      expect(contrastRatio(c.text, c.background), `${id} texto`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.text, c.surface), `${id} tarjetas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.muted, c.background), `${id} secundario`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.primaryContrast, c.primary), `${id} botones`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("escenas", () => {
  it("cada fecha trae su decoración", () => {
    const h = SPECIAL_DAY_STYLES.halloween.scene;
    expect(h.ground).toContain("💀");
    expect(h.cobwebs).toBe(true);
    expect(SPECIAL_DAY_STYLES.christmas.scene.ground).toContain("🎄");
    expect(SPECIAL_DAY_STYLES.christmas.scene.garland.kind).toBe("lights");
    expect(SPECIAL_DAY_STYLES.newYear.scene.fireworks).toBe(true);
    for (const [id, style] of Object.entries(SPECIAL_DAY_STYLES)) {
      expect(style.scene.ground.length, id).toBeGreaterThan(0);
      expect(style.scene.garland.items.length, id).toBeGreaterThan(0);
      if (style.scene.garland.kind !== "emoji") {
        expect(style.scene.garland.items.every((c) => /^#[0-9a-f]{6}$/i.test(c)), id).toBe(true);
      }
    }
  });
});
