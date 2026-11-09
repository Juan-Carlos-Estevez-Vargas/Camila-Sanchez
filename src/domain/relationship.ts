import { parseIsoDate } from "./dates";
import type { ImportantDate, IsoDate, SiteSettings } from "./types";

type Dates = Pick<SiteSettings, "relationshipStart" | "relationshipEnd">;

/**
 * Fin de la relación. Cuando hay `relationshipEnd`:
 *   - el contador de «tiempo juntos» se queda quieto en ese día,
 *   - la portada dice «del … al …»,
 *   - el aniversario deja de celebrarse (tema del día y cuenta regresiva).
 * No se borra nada: si se quita la fecha, todo vuelve a como estaba.
 */
export function relationshipEnded(s: Dates): boolean {
  return !!s.relationshipStart && !!s.relationshipEnd;
}

/** Hasta cuándo cuenta el contador: el día del final (a medianoche) o ahora. */
export function counterUntil(s: Dates, now: Date = new Date()): Date {
  if (!relationshipEnded(s)) return now;
  const end = parseIsoDate(s.relationshipEnd!);
  return end < now ? end : now;
}

/** La fecha que se celebra como aniversario, o null si ya no se celebra. */
export function anniversaryStart(s: Dates): IsoDate | null {
  return relationshipEnded(s) ? null : s.relationshipStart;
}

/** ¿Es esta fecha importante el aniversario? (se repite cada año el mismo día en que empezó todo). */
export function isAnniversaryDate(date: ImportantDate, relationshipStart: IsoDate | null): boolean {
  return !!relationshipStart && date.recursYearly && date.eventDate.slice(5) === relationshipStart.slice(5);
}

/** Las fechas para las cuentas regresivas: sin el aniversario si la relación terminó. */
export function countdownDates(dates: ImportantDate[], s: Dates): ImportantDate[] {
  if (!relationshipEnded(s)) return dates;
  return dates.filter((d) => !isAnniversaryDate(d, s.relationshipStart));
}

/** El fin no puede ser antes del inicio. */
export function validRelationshipEnd(s: Dates): boolean {
  return !s.relationshipEnd || !s.relationshipStart || s.relationshipEnd >= s.relationshipStart;
}
