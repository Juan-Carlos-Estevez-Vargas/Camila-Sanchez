/**
 * Novedades de cada versión.
 *
 * Cada vez que se publica algo que la gente nota, se suma arriba de
 * `RELEASES` una entrada con la fecha y sus novedades. Los textos viven en
 * `i18n/messages/<idioma>/whatsNew.ts` con la misma clave. Después de
 * actualizar, la app muestra lo que la persona no ha visto y, si una novedad
 * tiene `tour`, la lleva a esa página con el tutorial de la función.
 *
 * Funciones puras: qué mostrar se decide aquí y se prueba sin navegador.
 */
import { PERMISSIONS, type Permission } from "./permissions";

export interface Novelty {
  /** Clave de sus textos en `whatsNew.releases[<release>].news`. */
  id: string;
  icon: string;
  /** Sólo la ve quien tiene este permiso. */
  requires?: Permission;
  /** Página a la que lleva «Ver cómo funciona» (con el tutorial de esa página). */
  tour?: string;
}

export interface Release {
  /** Fecha de publicación (AAAA-MM-DD). También es la clave de sus textos. */
  id: string;
  news: Novelty[];
}

/** De la más nueva a la más antigua. */
export const RELEASES: Release[] = [
  {
    id: "2026-11-08",
    news: [
      { id: "dedications", icon: "💌", requires: PERMISSIONS.dedicationsUse, tour: "/dedicatorias" },
      { id: "whatsNew", icon: "✨" },
    ],
  },
  {
    id: "2026-11-05",
    news: [
      { id: "received", icon: "🎁", requires: PERMISSIONS.notesSend, tour: "/mensajes" },
      { id: "audit", icon: "🔎", requires: PERMISSIONS.auditView },
    ],
  },
  {
    id: "2026-11-04",
    news: [
      { id: "languages", icon: "🌐" },
      { id: "install", icon: "📲" },
    ],
  },
  {
    id: "2026-11-03",
    news: [
      { id: "chat", icon: "💬", requires: PERMISSIONS.chatUse, tour: "/chat" },
      { id: "surprises", icon: "🎉" },
    ],
  },
  {
    id: "2026-10-21",
    news: [
      { id: "lists", icon: "📝", requires: PERMISSIONS.listsUse, tour: "/listas" },
      { id: "profile", icon: "🙂", tour: "/cuenta/perfil" },
    ],
  },
];

/** Lo que una persona puede ver de una versión (las novedades de lo que puede usar). */
export function visibleRelease(release: Release, can: (permission: Permission) => boolean): Release {
  return { ...release, news: release.news.filter((n) => !n.requires || can(n.requires)) };
}

/**
 * Versiones que todavía no vio, de la más nueva a la más antigua.
 *
 * - Si ya vio alguna, todas las posteriores a esa.
 * - Si nunca vio ninguna, sólo la última (no toda la historia), y nada si su
 *   cuenta es más nueva que esa versión: ya la conoció así.
 */
export function pendingReleases(
  releases: readonly Release[],
  { lastSeen, accountCreatedAt }: { lastSeen: string | null; accountCreatedAt?: string | null },
): Release[] {
  if (lastSeen) return releases.filter((r) => r.id > lastSeen);
  const latest = releases[0];
  if (!latest) return [];
  const joined = accountCreatedAt?.slice(0, 10);
  return joined && joined > latest.id ? [] : [latest];
}

/** La versión más nueva (lo que se guarda como «ya visto»). */
export const latestRelease = (releases: readonly Release[] = RELEASES): string | null => releases[0]?.id ?? null;
