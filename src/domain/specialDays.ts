/**
 * Fechas especiales: el cumpleaños de ella, el aniversario, San Valentín,
 * Amor y Amistad, Halloween, Navidad y Año Nuevo. Ese día (completo, de
 * medianoche a medianoche en la hora del teléfono de quien mira) toda la
 * página cambia de tema: colores, emojis de fondo, saludo y decoración.
 *
 * Funciones puras: qué fecha toca se decide aquí y se prueba sin navegador.
 * La configuración vive dentro de `site_settings.effects.specialDays`, así
 * que la cambia quien tiene `theme.manage` y no hace falta otra tabla.
 */
import { asStringArray } from "@/core/validation";
import { parseIsoDate } from "./dates";
import type { PaletteColors } from "./palettes";
import type { IsoDate, ThemeTokens } from "./types";

/** En orden de prioridad: si dos caen el mismo día, gana la primera. */
export const SPECIAL_DAY_IDS = [
  "birthday", "anniversary", "valentine", "friendship", "halloween", "christmas", "newYear",
] as const;
export type SpecialDayId = (typeof SPECIAL_DAY_IDS)[number];

export interface SpecialDaysConfig {
  /** Interruptor general: apagado, la página nunca cambia sola. */
  enabled: boolean;
  /** Fecha de nacimiento de la cumpleañera (sólo importan el día y el mes). */
  birthday: IsoDate | null;
  /** Nombre para el saludo («¡Feliz cumpleaños, Camila!»). */
  birthdayName: string;
  /** Fechas que se apagaron una por una. */
  off: SpecialDayId[];
}

export const DEFAULT_SPECIAL_DAYS: SpecialDaysConfig = {
  enabled: true,
  birthday: null,
  birthdayName: "",
  off: [],
};

export interface SpecialDayStyle {
  icon: string;
  colors: PaletteColors;
  /** Los temas de noche fuerzan sus propios fondos aunque el sitio esté en modo oscuro. */
  darkMode?: ThemeTokens["darkMode"];
  /** Emojis que flotan de fondo todo el día. */
  emojis: string[];
  density: number;
  /** Lluvia de emojis al abrir la página ese día. */
  burst: string[];
}

export const SPECIAL_DAY_STYLES: Record<SpecialDayId, SpecialDayStyle> = {
  birthday: {
    icon: "🎂",
    colors: { primary: "#c2255c", primaryContrast: "#ffffff", accent: "#f2b705", background: "#fff6e8", surface: "#ffffff", text: "#4a1630", muted: "#7d4560" },
    emojis: ["🎈", "🎂", "🎉", "🎁", "🥳", "💖", "✨", "🌸"],
    density: 24,
    burst: ["🎉", "🎊", "🎈", "💖", "✨", "🥳"],
  },
  anniversary: {
    icon: "💍",
    colors: { primary: "#a8123a", primaryContrast: "#ffffff", accent: "#d9a441", background: "#fff1f3", surface: "#fffafb", text: "#4a0d1f", muted: "#7d3a4d" },
    emojis: ["💍", "❤️", "🥂", "🌹", "✨", "💞"],
    density: 20,
    burst: ["❤️", "💍", "🌹", "✨"],
  },
  valentine: {
    icon: "💘",
    colors: { primary: "#c8104a", primaryContrast: "#ffffff", accent: "#ff7aa2", background: "#ffeef3", surface: "#fff9fb", text: "#5c0a26", muted: "#8a3553" },
    emojis: ["💘", "💝", "❤️", "🌹", "💌", "💕"],
    density: 22,
    burst: ["💘", "❤️", "💕", "🌹"],
  },
  friendship: {
    icon: "💛",
    colors: { primary: "#b5452c", primaryContrast: "#ffffff", accent: "#ffc93c", background: "#fff8e6", surface: "#fffdf7", text: "#4a2a12", muted: "#7a5332" },
    emojis: ["💛", "🧡", "🤝", "🎁", "💌", "🌻"],
    density: 18,
    burst: ["💛", "🧡", "🎁", "🌻"],
  },
  halloween: {
    icon: "🎃",
    colors: { primary: "#ff8a1f", primaryContrast: "#1a0f1f", accent: "#a970ff", background: "#16101e", surface: "#231a2e", text: "#f6eee6", muted: "#c4b4cb" },
    darkMode: "light",
    emojis: ["🎃", "👻", "🦇", "🕸️", "🍬", "🕯️"],
    density: 20,
    burst: ["🎃", "👻", "🦇", "🍬"],
  },
  christmas: {
    icon: "🎄",
    colors: { primary: "#b8202c", primaryContrast: "#ffffff", accent: "#e0a83a", background: "#eef6f0", surface: "#ffffff", text: "#173a27", muted: "#4a6b55" },
    emojis: ["❄️", "🎄", "🎁", "⭐", "🔔", "❄️"],
    density: 26,
    burst: ["🎁", "🎄", "⭐", "❄️"],
  },
  newYear: {
    icon: "🎆",
    colors: { primary: "#e8b923", primaryContrast: "#1a1530", accent: "#c9a0ff", background: "#110f24", surface: "#1d1a38", text: "#f5f1ff", muted: "#bdb5d9" },
    darkMode: "light",
    emojis: ["🎆", "🥂", "✨", "🎇", "🍾", "⭐"],
    density: 22,
    burst: ["🎆", "🥂", "✨", "🎇"],
  },
};

export interface ActiveSpecialDay {
  id: SpecialDayId;
  style: SpecialDayStyle;
  /** Años que se cumplen (aniversario); null en las demás. */
  years: number | null;
}

const isId = (v: unknown): v is SpecialDayId => (SPECIAL_DAY_IDS as readonly unknown[]).includes(v);

export function normalizeSpecialDays(raw: unknown): SpecialDaysConfig {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const birthday = typeof o.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.birthday) && !Number.isNaN(Date.parse(o.birthday))
    ? o.birthday
    : null;
  return {
    enabled: o.enabled !== false,
    birthday,
    // Sin recortar espacios: se escribe letra a letra en el panel («Camila Sánchez»).
    birthdayName: typeof o.birthdayName === "string" ? o.birthdayName.slice(0, 40) : "",
    off: [...new Set(asStringArray(o.off, SPECIAL_DAY_IDS.length, 20).filter(isId))],
  };
}

/** El mismo día y mes de una fecha en otro año (el 29 de febrero cae el 28 en años no bisiestos). */
function sameDayIn(year: number, date: IsoDate): Date {
  const base = parseIsoDate(date);
  const d = new Date(year, base.getMonth(), base.getDate());
  return d.getMonth() === base.getMonth() ? d : new Date(year, base.getMonth() + 1, 0);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Tercer sábado de septiembre: el Día del Amor y la Amistad en Colombia. */
export function friendshipDay(year: number): Date {
  const first = new Date(year, 8, 1);
  const firstSaturday = 1 + ((6 - first.getDay() + 7) % 7);
  return new Date(year, 8, firstSaturday + 14);
}

/** ¿Qué día del año es esta fecha especial? Devuelve los días que la celebran en ese año. */
export function specialDayDates(
  id: SpecialDayId,
  year: number,
  config: SpecialDaysConfig,
  relationshipStart: IsoDate | null,
): Date[] {
  switch (id) {
    case "birthday":
      return config.birthday ? [sameDayIn(year, config.birthday)] : [];
    case "anniversary": {
      if (!relationshipStart) return [];
      return year > parseIsoDate(relationshipStart).getFullYear() ? [sameDayIn(year, relationshipStart)] : [];
    }
    case "valentine":
      return [new Date(year, 1, 14)];
    case "friendship":
      return [friendshipDay(year)];
    case "halloween":
      return [new Date(year, 9, 31)];
    case "christmas":
      return [new Date(year, 11, 24), new Date(year, 11, 25)];
    case "newYear":
      return [new Date(year, 0, 1), new Date(year, 11, 31)];
  }
}

/**
 * La fecha especial de hoy (o null). Respeta el interruptor general y las
 * fechas apagadas; si coinciden dos, gana la de más prioridad (el cumpleaños).
 */
export function specialDayOn(
  config: SpecialDaysConfig,
  relationshipStart: IsoDate | null,
  now: Date = new Date(),
): ActiveSpecialDay | null {
  if (!config.enabled) return null;
  const year = now.getFullYear();
  for (const id of SPECIAL_DAY_IDS) {
    if (config.off.includes(id)) continue;
    if (!specialDayDates(id, year, config, relationshipStart).some((d) => sameDay(d, now))) continue;
    const years = id === "anniversary" && relationshipStart ? year - parseIsoDate(relationshipStart).getFullYear() : null;
    return { id, style: SPECIAL_DAY_STYLES[id], years };
  }
  return null;
}

/** Una fecha especial para la vista previa del panel (sin mirar el calendario). */
export function previewSpecialDay(id: SpecialDayId, relationshipStart: IsoDate | null, now: Date = new Date()): ActiveSpecialDay {
  const years = id === "anniversary" && relationshipStart
    ? Math.max(1, now.getFullYear() - parseIsoDate(relationshipStart).getFullYear())
    : null;
  return { id, style: SPECIAL_DAY_STYLES[id], years };
}

export function parseSpecialDayId(value: string | null): SpecialDayId | null {
  return isId(value) ? value : null;
}

/** El tema de ese día: sus colores encima del de la página (y por encima de los de cada persona). */
export function specialTheme(site: ThemeTokens, day: ActiveSpecialDay): ThemeTokens {
  return { ...site, ...day.style.colors, darkMode: day.style.darkMode ?? site.darkMode };
}

/** Milisegundos hasta la próxima medianoche local (para cambiar de tema justo a tiempo). */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
