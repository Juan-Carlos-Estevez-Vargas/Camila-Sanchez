/**
 * El ramo de flores de cada fecha especial.
 *
 * Ese día, al entrar, la destinataria ve una animación que le revela un ramo
 * elegido por lo que significan sus flores (en el cumpleaños, gerberas) junto
 * a una notita: una invitación de Juan («te espero en tal lugar…»). Todo el
 * día queda un botón 💐 para volver a abrirlo, y cada apertura queda en
 * Auditoría → Actividad como la página «/ramo/<fecha>/<cómo>».
 *
 * Qué se guarda dónde:
 *   - Encendido, para quién es y la firma: en `site_settings.effects.specialDays.bouquet`
 *     (no dicen nada de la sorpresa).
 *   - El lugar, la hora y el mensaje de cada fecha: en la tabla `bouquet_notes`,
 *     que un anónimo no puede leer (los ajustes del sitio sí son públicos).
 *
 * Funciones puras: quién lo ve y qué dice la nota se decide aquí y se prueba
 * sin navegador.
 */
// Sólo tipos de specialDays.ts: ese módulo importa éste (sin ciclos al cargar).
import type { SpecialDayId } from "./specialDays";
import type { Uuid } from "./types";

/** Forma de dibujar cada flor (ver features/bouquet/FlowerArt.tsx). */
export type FlowerKind = "gerbera" | "peony" | "rose" | "sunflower" | "dahlia" | "poinsettia" | "tulip";

export interface BouquetStyle {
  flower: FlowerKind;
  /** Colores de las flores, uno por flor (se repiten si hay más flores). */
  colors: string[];
  /** Centro de la flor (el botón de la gerbera, las semillas del girasol). */
  center: string;
  leaf: string;
  /** Papel del envoltorio: por fuera y por dentro. */
  paper: [string, string];
  ribbon: string;
  /** Lo que cae alrededor mientras se abre (pétalos de su color). */
  petal: string;
  /** Emoji del botón de volver a abrirlo y de la nota. */
  icon: string;
}

/**
 * Las flores de cada fecha, elegidas por su significado (el texto del
 * significado vive en i18n `bouquet.flowers`).
 */
export const BOUQUETS: Record<SpecialDayId, BouquetStyle> = {
  // Gerberas: alegría, inocencia y las ganas de vivir.
  birthday: {
    flower: "gerbera",
    colors: ["#ff5c8a", "#ff8c42", "#ffd23f", "#ff3d68", "#f7a1c4", "#ff9f1c", "#e63973"],
    center: "#4a2a12", leaf: "#3f9b4f", paper: ["#f6d7e0", "#fff4f7"], ribbon: "#d81b60", petal: "#ff8fb1", icon: "💐",
  },
  // Peonías: el amor que dura y un futuro feliz juntos.
  anniversary: {
    flower: "peony",
    colors: ["#f48fb1", "#f8bbd0", "#ec6f9b", "#fcd5e0", "#e75c8d", "#f9a8c6", "#f06292"],
    center: "#ffe082", leaf: "#4c8c4a", paper: ["#efe3d3", "#fffaf2"], ribbon: "#a8123a", petal: "#f8bbd0", icon: "💐",
  },
  // Rosas rojas: el amor apasionado, un «te amo» sin palabras.
  valentine: {
    flower: "rose",
    colors: ["#c8102e", "#e01e48", "#a50d2b", "#d6173f", "#b30f30", "#e8325a", "#c8102e"],
    center: "#7a0619", leaf: "#2f7d3c", paper: ["#1f1a1c", "#3a3034"], ribbon: "#ff6f9c", petal: "#e01e48", icon: "🌹",
  },
  // Girasoles: lealtad y admiración; siempre buscan su sol.
  friendship: {
    flower: "sunflower",
    colors: ["#ffc107", "#ffb300", "#ffca28", "#ffa000", "#ffd54f", "#ffb300", "#ffc107"],
    center: "#5d3a1a", leaf: "#558b2f", paper: ["#d7c4a3", "#f5ecd9"], ribbon: "#e8505b", petal: "#ffd54f", icon: "🌻",
  },
  // Dalias moradas y naranjas: elegancia, misterio y un vínculo que no se rompe.
  halloween: {
    flower: "dahlia",
    colors: ["#7b2cbf", "#ff7b1c", "#5a189a", "#ff9e40", "#9d4edd", "#e85d04", "#6a1b9a"],
    center: "#ffd166", leaf: "#2d6a4f", paper: ["#1b1324", "#2e2140"], ribbon: "#ff7b1c", petal: "#9d4edd", icon: "🌺",
  },
  // Flores de Nochebuena: la alegría de la Navidad y los buenos deseos.
  christmas: {
    flower: "poinsettia",
    colors: ["#c1121f", "#d62828", "#e63946", "#b5121b", "#f1f1f1", "#d62828", "#c1121f"],
    center: "#f4c430", leaf: "#1b5e20", paper: ["#d9c6a5", "#f8f1e4"], ribbon: "#d4a017", petal: "#e63946", icon: "🌺",
  },
  // Tulipanes: los nuevos comienzos y el amor perfecto.
  newYear: {
    flower: "tulip",
    colors: ["#ffffff", "#f6c945", "#ffe8a3", "#fff4d6", "#e8b923", "#ffffff", "#f6c945"],
    center: "#e8b923", leaf: "#3e8e5a", paper: ["#14102b", "#2a2350"], ribbon: "#e8b923", petal: "#ffe8a3", icon: "🌷",
  },
};

export const MAX_BOUQUET_PLACE = 80;
export const MAX_BOUQUET_TIME = 40;
export const MAX_BOUQUET_MESSAGE = 600;
export const MAX_BOUQUET_SIGNATURE = 40;

export interface BouquetConfig {
  /** Apagado, no sale ningún ramo. */
  enabled: boolean;
  /** Para quién es. null: para quien entra con su cuenta y no puede editar la Apariencia. */
  recipientId: Uuid | null;
  /** Cómo firma la nota («Tu Juan»). Vacío: la firma de la app. */
  signature: string;
}

export const DEFAULT_BOUQUET: BouquetConfig = { enabled: true, recipientId: null, signature: "" };

/** La notita de una fecha (tabla `bouquet_notes`). */
export interface BouquetNote {
  dayId: SpecialDayId;
  /** Dónde la espera («el restaurante de siempre»). */
  place: string;
  /** A qué hora («8:00 p. m.»). */
  time: string;
  /** Mensaje propio; vacío: el de la app. Admite {lugar}, {hora} y {nombre}. */
  message: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeBouquet(raw: unknown): BouquetConfig {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    enabled: o.enabled !== false,
    recipientId: typeof o.recipientId === "string" && UUID_RE.test(o.recipientId) ? o.recipientId : null,
    signature: typeof o.signature === "string" ? o.signature.slice(0, MAX_BOUQUET_SIGNATURE) : "",
  };
}

const isDay = (v: unknown): v is SpecialDayId => typeof v === "string" && Object.hasOwn(BOUQUETS, v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function normalizeBouquetNote(raw: unknown): BouquetNote | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (!isDay(o.dayId)) return null;
  return {
    dayId: o.dayId,
    place: text(o.place, MAX_BOUQUET_PLACE),
    time: text(o.time, MAX_BOUQUET_TIME),
    message: text(o.message, MAX_BOUQUET_MESSAGE),
  };
}

export const emptyNote = (dayId: SpecialDayId): BouquetNote => ({ dayId, place: "", time: "", message: "" });

/**
 * ¿A esta persona le sale el ramo? Sólo con cuenta; si en Apariencia se
 * eligió para quién es, sólo a esa persona; si no, a quien no puede editar la
 * Apariencia (quien la prepara no se lo encuentra de sorpresa).
 */
export function isBouquetRecipient(
  config: BouquetConfig,
  viewer: { userId: Uuid | null; canManageTheme: boolean },
): boolean {
  if (!config.enabled || !viewer.userId) return false;
  return config.recipientId ? viewer.userId === config.recipientId : !viewer.canManageTheme;
}

/** Cómo se abrió: solo al entrar o con el botón 💐. */
export type BouquetTrigger = "auto" | "boton";

/** La «página» que queda en la actividad mientras el ramo está abierto. */
export const bouquetPath = (dayId: SpecialDayId, trigger: BouquetTrigger) => `/ramo/${dayId}/${trigger}`;

/** Lee de vuelta una ruta de ramo (para la lista de Actividad). */
export function parseBouquetPath(path: string): { dayId: SpecialDayId; trigger: BouquetTrigger } | null {
  const m = /^\/ramo\/([A-Za-z]+)\/(auto|boton)$/.exec(path);
  if (!m || !isDay(m[1])) return null;
  return { dayId: m[1], trigger: m[2] as BouquetTrigger };
}

/** Clave del «ya se abrió solo hoy» (una vez por día y por navegador). */
export function bouquetDayKey(dayId: SpecialDayId, now: Date = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${dayId}:${d}`;
}

/** Cambia {lugar}, {hora} y {nombre} en un mensaje propio. */
export function fillBouquetMessage(template: string, values: { place: string; time: string; name: string }): string {
  return template
    .replace(/\{lugar\}/gi, values.place)
    .replace(/\{hora\}/gi, values.time)
    .replace(/\{nombre\}/gi, values.name)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Dónde se dibuja cada flor dentro del ramo (viewBox 320 × 400): una copa de
 * flores sobre el envoltorio. La primera es la del centro, al frente.
 */
export const BOUQUET_LAYOUT: ReadonlyArray<{ x: number; y: number; r: number; tilt: number }> = [
  { x: 160, y: 150, r: 46, tilt: 0 },
  { x: 92, y: 168, r: 38, tilt: -14 },
  { x: 228, y: 168, r: 38, tilt: 12 },
  { x: 120, y: 96, r: 36, tilt: -8 },
  { x: 202, y: 98, r: 36, tilt: 9 },
  { x: 58, y: 116, r: 30, tilt: -22 },
  { x: 262, y: 118, r: 30, tilt: 20 },
];
