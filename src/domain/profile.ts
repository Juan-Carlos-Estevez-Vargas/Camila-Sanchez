/** Reglas del perfil de cada persona: iniciales, icono y cumpleaños. */
import { daysUntil, parseIsoDate } from "./dates";
import type { IsoDate } from "./types";

export const AVATAR_EMOJIS = [
  "💖", "🌸", "🌻", "🌙", "⭐", "🦋", "🐱", "🐶", "🐻", "🐰", "🦊", "🐼",
  "🍓", "🍒", "☕", "🎧", "📚", "🎨", "⚽", "🎮", "✈️", "🌊", "🔥", "😎",
] as const;

export const MAX_BIO_LENGTH = 160;

/** Letra que se muestra cuando no hay foto ni icono. */
export function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

const birthdayFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" });

export interface BirthdayInfo {
  /** «15 de marzo» (sin el año). */
  label: string;
  /** Días que faltan para el próximo (0 = hoy). */
  daysLeft: number;
}

/** Próximo cumpleaños a partir de la fecha de nacimiento (el 29 de febrero cae el 28 en años no bisiestos). */
export function birthdayInfo(birthday: IsoDate, now: Date = new Date()): BirthdayInfo {
  const born = parseIsoDate(birthday);
  const on = (year: number) => {
    const date = new Date(year, born.getMonth(), born.getDate());
    return date.getMonth() === born.getMonth() ? date : new Date(year, born.getMonth() + 1, 0);
  };
  let next = on(now.getFullYear());
  if (daysUntil(next, now) < 0) next = on(now.getFullYear() + 1);
  return { label: birthdayFormatter.format(born), daysLeft: daysUntil(next, now) };
}

/** «¡Hoy es su cumpleaños! 🎂», «Mañana cumple años», «En 12 días» o nada si falta mucho. */
export function birthdayCountdown(info: BirthdayInfo): string | null {
  if (info.daysLeft === 0) return "¡Hoy es su cumpleaños! 🎂";
  if (info.daysLeft === 1) return "Mañana cumple años 🎈";
  if (info.daysLeft <= 30) return `Cumple en ${info.daysLeft} días`;
  return null;
}
