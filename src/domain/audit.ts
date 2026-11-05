/**
 * Reglas puras de la pantalla de Auditoría: rangos de meses y filtros.
 * Sin React ni backend para poder probarlas solas.
 */
import type { AuditEntry, IsoDateTime } from "./types";

/** Mes en formato "AAAA-MM" (hora local). */
export type MonthKey = string;

/** Valor especial del desplegable de meses: sin límite de fechas. */
export const ALL_MONTHS = "all";

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Inicio (incluido) y fin (excluido) del mes, en hora local, como ISO. */
export function monthRange(key: MonthKey): { from: IsoDateTime; to: IsoDateTime } {
  const [year = 1970, month = 1] = key.split("-").map(Number);
  return {
    from: new Date(year, month - 1, 1).toISOString(),
    to: new Date(year, month, 1).toISOString(),
  };
}

/** Este mes y los `count - 1` anteriores, del más nuevo al más viejo. */
export function recentMonths(now: Date, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

/** Filtros del registro. `actorId: "system"` busca los cambios sin persona. */
export interface AuditFilters {
  table?: string;
  actorId?: string;
  action?: AuditEntry["action"];
  from?: IsoDateTime;
  to?: IsoDateTime;
}

/** Aplica los filtros en memoria (modo demo); Supabase hace lo mismo en SQL. */
export function matchesAudit(entry: AuditEntry, f: AuditFilters): boolean {
  if (f.table && entry.tableName !== f.table) return false;
  if (f.action && entry.action !== f.action) return false;
  if (f.actorId && (f.actorId === "system" ? entry.actorId !== null : entry.actorId !== f.actorId)) return false;
  const at = Date.parse(entry.createdAt);
  if (f.from && at < Date.parse(f.from)) return false;
  if (f.to && at >= Date.parse(f.to)) return false;
  return true;
}
