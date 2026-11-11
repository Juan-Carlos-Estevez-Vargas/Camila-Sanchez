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
import { normalizeDaySongs } from "./specialMusic";
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
  /** Música suave de fondo ese día (ver specialMusic.ts). */
  music: boolean;
  /** Canciones propias de cada fecha (YouTube o archivos de audio) en vez de la melodía de la app. */
  songs: Partial<Record<SpecialDayId, string[]>>;
}

export const DEFAULT_SPECIAL_DAYS: SpecialDaysConfig = {
  enabled: true,
  birthday: null,
  birthdayName: "",
  off: [],
  music: true,
  songs: {},
};

/**
 * La escena animada de cada fecha (state/../SpecialDayScene.tsx). Todo es
 * decoración: pointer-events none, aria-hidden, y con «Reducir animaciones»
 * sólo quedan quietos la guirnalda, el suelo y las esquinas.
 */
export interface SpecialScene {
  /** Lo que cae meciéndose: nieve, hojas, pétalos, confeti. */
  fall: string[];
  /** Confeti de colores (papelitos) además de lo que cae. */
  confetti: boolean;
  /** Guirnalda bajo la cabecera: emojis, luces de colores o banderines. */
  garland: { kind: "emoji" | "lights" | "bunting"; items: string[] };
  /** Fila del suelo (árboles, calabazas, regalos). */
  ground: string[];
  /** Lo que cruza volando la pantalla (murciélagos, el trineo, estrellas fugaces). */
  flyers: string[];
  /** Lo que cuelga de un hilo y sube y baja (arañas, adornos). */
  hang: string[];
  /** Telarañas en las esquinas. */
  cobwebs: boolean;
  /** Fuegos artificiales que estallan de fondo. */
  fireworks: boolean;
}

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
  scene: SpecialScene;
}

const scene = (patch: Partial<SpecialScene>): SpecialScene => ({
  fall: [], confetti: false, garland: { kind: "emoji", items: [] }, ground: [], flyers: [], hang: [],
  cobwebs: false, fireworks: false, ...patch,
});

export const SPECIAL_DAY_STYLES: Record<SpecialDayId, SpecialDayStyle> = {
  birthday: {
    icon: "🎂",
    colors: { primary: "#c81d6a", primaryContrast: "#ffffff", accent: "#ffb703", background: "#fff3e3", surface: "#ffffff", text: "#47122f", muted: "#7a3b5c" },
    emojis: ["🎈", "🎈", "🎂", "🎉", "🎁", "🥳", "💖", "✨"],
    density: 26,
    burst: ["🎉", "🎊", "🎈", "💖", "✨", "🥳"],
    scene: scene({
      fall: ["🎊", "✨"],
      confetti: true,
      garland: { kind: "bunting", items: ["#ff4d8d", "#ffb703", "#3ec7c2", "#8c5cff", "#ff7a3d"] },
      ground: ["🎁", "🎂", "🎈", "🎁", "🥳", "🎁", "🎈", "🎂"],
      hang: ["🎈", "🎀", "🎈"],
    }),
  },
  anniversary: {
    icon: "💍",
    colors: { primary: "#a8123a", primaryContrast: "#ffffff", accent: "#d9a441", background: "#fff0f2", surface: "#fffafb", text: "#480c1e", muted: "#7a364a" },
    emojis: ["💍", "❤️", "🥂", "🌹", "✨", "💞"],
    density: 20,
    burst: ["❤️", "💍", "🌹", "✨"],
    scene: scene({
      fall: ["🌹", "❤️", "✨"],
      garland: { kind: "emoji", items: ["💍", "❤️", "🥂", "❤️"] },
      ground: ["🌹", "🥂", "🌹", "💐", "🌹"],
      flyers: ["🕊️", "🕊️"],
    }),
  },
  valentine: {
    icon: "💘",
    colors: { primary: "#c8104a", primaryContrast: "#ffffff", accent: "#ff6f9c", background: "#ffecf2", surface: "#fff9fb", text: "#5a0a25", muted: "#873251" },
    emojis: ["💘", "💝", "❤️", "🌹", "💌", "💕"],
    density: 24,
    burst: ["💘", "❤️", "💕", "🌹"],
    scene: scene({
      fall: ["💗", "🌸", "❤️"],
      garland: { kind: "emoji", items: ["❤️", "💕", "💘", "💕"] },
      ground: ["🌹", "💝", "🌹", "💌", "🌹", "🧸"],
      flyers: ["💘"],
    }),
  },
  friendship: {
    icon: "💛",
    colors: { primary: "#b5452c", primaryContrast: "#ffffff", accent: "#ffc93c", background: "#fff7e0", surface: "#fffdf7", text: "#472811", muted: "#765030" },
    emojis: ["💛", "🧡", "🤝", "🎁", "💌", "🌻"],
    density: 20,
    burst: ["💛", "🧡", "🎁", "🌻"],
    scene: scene({
      fall: ["🌼", "💛", "🧡"],
      garland: { kind: "bunting", items: ["#ffc93c", "#ff8a3d", "#e8505b", "#ffde7d"] },
      ground: ["🌻", "🎁", "🌻", "💌", "🌻", "🌷"],
      flyers: ["🦋", "🦋"],
    }),
  },
  halloween: {
    icon: "🎃",
    colors: { primary: "#ff7b1c", primaryContrast: "#160c1d", accent: "#9b6bff", background: "#110a19", surface: "#1e142b", text: "#f8efe4", muted: "#c7b5cf" },
    darkMode: "light",
    emojis: ["🎃", "👻", "💀", "🦇", "🍬", "🕯️"],
    density: 22,
    burst: ["🎃", "👻", "💀", "🦇", "🍬"],
    scene: scene({
      fall: ["🍂", "🍁"],
      garland: { kind: "emoji", items: ["🎃", "💀", "🦇", "💀"] },
      ground: ["🎃", "🪦", "💀", "🕯️", "🎃", "🪦", "🍬", "💀", "🎃"],
      flyers: ["🦇", "🦇", "🧙‍♀️", "🦇"],
      hang: ["🕷️", "💀", "🕷️"],
      cobwebs: true,
    }),
  },
  christmas: {
    icon: "🎄",
    colors: { primary: "#c1121f", primaryContrast: "#ffffff", accent: "#d4a017", background: "#f1f8f3", surface: "#ffffff", text: "#103522", muted: "#3c5c48" },
    emojis: ["🎄", "🎁", "⭐", "🔔", "🦌", "☃️"],
    density: 16,
    burst: ["🎁", "🎄", "⭐", "❄️"],
    scene: scene({
      fall: ["❄️", "❅", "❆", "❄️"],
      garland: { kind: "lights", items: ["#e63946", "#ffd166", "#2a9d8f", "#4cc9f0", "#f77f00"] },
      ground: ["🎄", "🎁", "☃️", "🎄", "🦌", "🎁", "🎄", "🎅", "🎄"],
      flyers: ["🛷"],
      hang: ["🔔", "⭐", "🎀"],
    }),
  },
  newYear: {
    icon: "🎆",
    colors: { primary: "#e8b923", primaryContrast: "#14102b", accent: "#c9a0ff", background: "#0d0b1f", surface: "#1a1735", text: "#f6f2ff", muted: "#bfb7dc" },
    darkMode: "light",
    emojis: ["🥂", "✨", "🍾", "⭐", "🎉"],
    density: 18,
    burst: ["🎆", "🥂", "✨", "🎇"],
    scene: scene({
      fall: ["✨", "⭐"],
      confetti: true,
      garland: { kind: "lights", items: ["#ffd166", "#ffffff", "#c9a0ff", "#ffd166"] },
      ground: ["🍾", "🥂", "🎉", "🕛", "🥂", "🍾"],
      flyers: ["🌠", "🌠"],
      fireworks: true,
    }),
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
    music: o.music !== false,
    songs: normalizeDaySongs(o.songs, SPECIAL_DAY_IDS),
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
