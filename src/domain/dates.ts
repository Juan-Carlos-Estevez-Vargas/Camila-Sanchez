import { dateFormat, getLocale, msg, relativeFormat } from "@/i18n/store";
import type { ImportantDate, IsoDate, Photo } from "./types";

const DAY_MS = 86_400_000;

/** Nombre del mes (0-11) en el idioma activo. */
export function monthName(month: number): string {
  return msg().dates.months[month] ?? "";
}

export const MONTH_ICONS = ["❄️", "💖", "🌸", "🌧️", "🌺", "☀️", "🏖️", "🔥", "🍂", "🎃", "🍁", "🎄"] as const;

/** Convierte YYYY-MM-DD a fecha local a medianoche (sin saltos por zona horaria). */
export function parseIsoDate(value: IsoDate): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface Elapsed {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Tiempo transcurrido desde una fecha (para el contador "tiempo juntos"). */
export function elapsedSince(start: Date, now: Date = new Date()): Elapsed {
  const diff = Math.max(0, now.getTime() - start.getTime());
  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

/**
 * Próxima ocurrencia de una fecha. Si se repite cada año y ya pasó este año,
 * devuelve la del año siguiente. Maneja el 29 de febrero en años no bisiestos
 * moviéndolo al 28.
 */
export function nextOccurrence(date: ImportantDate, now: Date = new Date()): Date | null {
  const base = parseIsoDate(date.eventDate);
  const today = startOfDay(now);
  if (!date.recursYearly) {
    return base >= today ? base : null;
  }
  const build = (year: number) => {
    const candidate = new Date(year, base.getMonth(), base.getDate());
    if (candidate.getMonth() !== base.getMonth()) {
      return new Date(year, base.getMonth() + 1, 0);
    }
    return candidate;
  };
  const thisYear = build(today.getFullYear());
  return thisYear >= today ? thisYear : build(today.getFullYear() + 1);
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export interface Countdown {
  date: ImportantDate;
  next: Date;
  days: number;
  /** Años que se cumplen en la próxima ocurrencia (aniversarios). */
  years: number | null;
}

/** Fechas visibles ordenadas por cercanía; descarta las únicas que ya pasaron. */
export function buildCountdowns(dates: ImportantDate[], now: Date = new Date()): Countdown[] {
  return dates
    .filter((d) => d.isVisible)
    .flatMap((date) => {
      const next = nextOccurrence(date, now);
      if (!next) return [];
      const years = date.recursYearly
        ? next.getFullYear() - parseIsoDate(date.eventDate).getFullYear()
        : null;
      return [{ date, next, days: daysUntil(next, now), years: years && years > 0 ? years : null }];
    })
    .sort((a, b) => a.days - b.days);
}

/**
 * El nombre de la fecha dentro de una frase («Faltan 3 días para tu
 * cumpleaños»). En español y portugués va con minúscula inicial; en inglés se
 * deja tal cual, porque ahí las fiestas van con mayúscula (Christmas).
 */
export function titleInSentence(title: string): string {
  if (getLocale() === "en") return title;
  return title.charAt(0).toLocaleLowerCase() + title.slice(1);
}

export function countdownLabel(c: Countdown): string {
  const t = msg().dates;
  const title = titleInSentence(c.date.title);
  if (c.days === 0) return t.countdownToday(title);
  if (c.days === 1) return t.countdownTomorrow(title);
  return t.countdownDays(c.days, title);
}

export interface MonthGroup {
  month: number; // 0-11
  photos: Photo[];
}

export interface YearGroup {
  year: number;
  total: number;
  months: MonthGroup[]; // siempre 12, vacíos incluidos
}

/** Agrupa fotos por año y mes, ordenadas por fecha y posición. */
export function groupPhotosByYearMonth(photos: Photo[]): YearGroup[] {
  const byYear = new Map<number, MonthGroup[]>();
  // Dentro de un mes manda el orden que se eligió con ↑ ↓ o arrastrando
  // (position); la fecha solo decide el mes y desempata. Antes se ordenaba
  // primero por día, así que una foto no podía pasar delante de otra de un
  // día anterior del mismo mes: se "devolvía" a su sitio al guardar.
  const sorted = [...photos].sort(
    (a, b) =>
      a.takenOn.slice(0, 7).localeCompare(b.takenOn.slice(0, 7)) ||
      a.position - b.position ||
      a.takenOn.localeCompare(b.takenOn),
  );
  for (const photo of sorted) {
    const date = parseIsoDate(photo.takenOn);
    const year = date.getFullYear();
    let months = byYear.get(year);
    if (!months) {
      months = Array.from({ length: 12 }, (_, month) => ({ month, photos: [] }));
      byYear.set(year, months);
    }
    months[date.getMonth()]!.photos.push(photo);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months,
      total: months.reduce((sum, m) => sum + m.photos.length, 0),
    }));
}

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export function formatLongDate(value: IsoDate): string {
  return dateFormat(LONG_DATE).format(parseIsoDate(value));
}

/** "hace 5 minutos", "ayer"... en el idioma activo. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const relative = relativeFormat();
  if (abs < 60) return relative.format(diffSec, "second");
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2_592_000) return relative.format(Math.round(diffSec / 86_400), "day");
  return dateFormat(LONG_DATE).format(new Date(iso));
}
