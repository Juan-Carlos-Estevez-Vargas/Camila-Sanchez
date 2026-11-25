/**
 * Reglas puras de la actividad en la app: a qué sección pertenece una página,
 * cómo se limpia la ruta antes de guardarla, qué dispositivo es y los totales
 * de la pantalla de Auditoría → Actividad. Sin React ni backend.
 *
 * Qué se guarda (y nada más): cuándo entra cada persona, qué páginas abre,
 * cuánto tiempo las tiene a la vista y el tipo de dispositivo. Nunca el
 * contenido de los mensajes, lo que escribe, la IP ni la ubicación.
 */
import type { ActivityDevice, ActivitySection, ActivitySession, IsoDateTime, PageView, Uuid } from "./types";

/** Cada cuánto se avisa que la página sigue a la vista. */
export const ACTIVITY_HEARTBEAT_MS = 30_000;
/** Sin usar la app más de esto, la próxima vez cuenta como otra visita. */
export const SESSION_GAP_MS = 30 * 60_000;
/** Tope de tiempo de una página (una pestaña olvidada no suma días). */
export const MAX_VIEW_SECONDS = 6 * 60 * 60;
/** Días que se guarda la actividad; lo más viejo se borra solo. */
export const ACTIVITY_RETENTION_DAYS = 180;

export const ACTIVITY_SECTIONS: readonly ActivitySection[] = [
  "inicio", "para-ti", "chat", "mensajes", "listas", "dedicatorias",
  "cuenta", "panel", "super", "legal", "instalar", "ramo", "otra",
];

const PREFIXES: ReadonlyArray<[string, ActivitySection]> = [
  ["/para-ti", "para-ti"], ["/despedida", "para-ti"], ["/chat", "chat"], ["/mensajes", "mensajes"],
  ["/listas", "listas"], ["/dedicatorias", "dedicatorias"], ["/cuenta", "cuenta"], ["/panel", "panel"],
  ["/super", "super"], ["/legal", "legal"], ["/instalar", "instalar"],
  // El ramo de flores de una fecha especial (no es una página: es la ventana abierta).
  ["/ramo", "ramo"],
];

/** Sección de la app a la que pertenece una ruta. */
export function sectionOf(path: string): ActivitySection {
  const clean = normalizePath(path);
  if (clean === "/") return "inicio";
  const hit = PREFIXES.find(([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`));
  return hit ? hit[1] : "otra";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ruta tal como se guarda: sin ?consulta ni #ancla, con los identificadores
 * cambiados por ":id" y el chat siempre como "/chat" (no se registra con
 * quién habla ni qué conversación abre).
 */
export function normalizePath(path: string): string {
  const bare = (path.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
  if (bare === "/chat" || bare.startsWith("/chat/")) return "/chat";
  return bare
    .split("/")
    .map((part) => (UUID_RE.test(part) || /^\d+$/.test(part) ? ":id" : part))
    .join("/")
    .slice(0, 120);
}

/** Lo justo para saber desde dónde entró: tipo de equipo, sistema y navegador. */
export function parseDevice(userAgent: string, opts: { touchPoints?: number; installed?: boolean } = {}): ActivityDevice {
  const ua = userAgent;
  // El iPad con iPadOS se presenta como Mac; se reconoce por la pantalla táctil.
  const ipadAsMac = /Macintosh/.test(ua) && (opts.touchPoints ?? 0) > 1;
  const os = /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) || ipadAsMac ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Otro";
  const browser = /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari"
    : "Otro";
  const kind: ActivityDevice["kind"] = /iPad|Tablet/.test(ua) || ipadAsMac || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? "tablet"
    : /Mobi|iPhone|iPod|Android/.test(ua) ? "phone" : "computer";
  return { kind, os, browser, installed: opts.installed === true };
}

/** Filtros de la actividad (los mismos de la auditoría: mes y persona). */
export interface ActivityFilters {
  userId?: Uuid;
  from?: IsoDateTime;
  to?: IsoDateTime;
}

/** Aplica los filtros en memoria (modo demo); Supabase hace lo mismo en SQL. */
export function matchesActivity(item: { userId: Uuid; startedAt: IsoDateTime }, f: ActivityFilters): boolean {
  if (f.userId && item.userId !== f.userId) return false;
  const at = Date.parse(item.startedAt);
  if (f.from && at < Date.parse(f.from)) return false;
  if (f.to && at >= Date.parse(f.to)) return false;
  return true;
}

export interface SectionTotal {
  section: ActivitySection;
  seconds: number;
  views: number;
}

export interface ActivitySummary {
  sessions: number;
  activeSeconds: number;
  /** Promedio por visita, en segundos (0 sin visitas). */
  averageSeconds: number;
  /** De la sección con más tiempo a la de menos; sólo las que tienen visitas. */
  bySection: SectionTotal[];
  /** Último momento en que se le vio usando la app. */
  lastSeenAt: IsoDateTime | null;
}

/** Totales de la pantalla de actividad a partir de las visitas y sus páginas. */
export function summarizeActivity(sessions: readonly ActivitySession[], views: readonly Pick<PageView, "section" | "seconds">[]): ActivitySummary {
  const totals = new Map<ActivitySection, SectionTotal>();
  for (const v of views) {
    const t = totals.get(v.section) ?? { section: v.section, seconds: 0, views: 0 };
    t.seconds += v.seconds;
    t.views += 1;
    totals.set(v.section, t);
  }
  const activeSeconds = sessions.reduce((sum, s) => sum + s.activeSeconds, 0);
  const lastSeenAt = sessions.reduce<IsoDateTime | null>((last, s) => (!last || s.lastSeenAt > last ? s.lastSeenAt : last), null);
  return {
    sessions: sessions.length,
    activeSeconds,
    averageSeconds: sessions.length ? Math.round(activeSeconds / sessions.length) : 0,
    bySection: [...totals.values()].sort((a, b) => b.seconds - a.seconds || b.views - a.views),
    lastSeenAt,
  };
}

/** "45 s", "3 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}
