/**
 * SEO como datos: a partir de la ruta y los ajustes del sitio decide título,
 * descripción, robots, URL canónica, etiquetas Open Graph y datos
 * estructurados. Es puro (sin DOM) para poder probarlo; quien lo aplica al
 * <head> es services/seo/head.ts.
 */
import { AUTHOR } from "./author.ts";
import type { SiteSettings } from "@/domain/types";

export const DEFAULT_TITLE = "Nuestro rincón";
export const DEFAULT_DESCRIPTION = "Nuestros recuerdos, fechas especiales, notitas y chat: una página hecha con amor.";
export const OG_IMAGE_PATH = "/og-image.jpg";
export const DESCRIPTION_MAX = 160;

/** Rutas que nunca deben aparecer en buscadores. */
export const PRIVATE_PREFIXES = ["/entrar", "/invitacion", "/recuperar", "/cuenta", "/panel", "/super", "/mensajes", "/chat", "/listas"] as const;

const PAGE_TITLES: Record<string, string> = {
  "/entrar": "Entrar",
  "/invitacion": "Invitación",
  "/recuperar": "Recuperar contraseña",
  "/cuenta": "Mi cuenta",
  "/mensajes": "Cajita de mensajes",
  "/chat": "Chat",
  "/listas": "Listas",
  "/panel": "Mi panel",
  "/super": "Administración",
};

const ROBOTS_INDEX = "index, follow, max-image-preview:large";
const ROBOTS_NOINDEX = "noindex, nofollow";

export interface SeoMeta {
  title: string;
  description: string;
  robots: string;
  /** URL canónica absoluta, o null si no sabemos el dominio. */
  canonical: string | null;
  image: string;
  /** Texto alternativo de la imagen para redes (accesible). */
  imageAlt: string;
  type: "website";
  locale: "es_CO";
  siteName: string;
  /** JSON-LD (schema.org) para la portada; null en las demás páginas. */
  structuredData: Record<string, unknown> | null;
}

export interface SeoContext {
  pathname: string;
  settings: SiteSettings | null;
  /** Dominio público, p. ej. https://nuestro-rincon.netlify.app (sin / final). */
  siteUrl: string;
  /** Interruptor global (VITE_SEO_INDEX=false lo apaga). */
  indexingEnabled: boolean;
}

export function normalizeSiteUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/.test(value) ? value : "";
}

/** Recorta en el último espacio para no cortar palabras y agrega "…". */
export function truncateDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

const isPrivatePath = (pathname: string) =>
  PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const privateTitle = (pathname: string) =>
  PAGE_TITLES[PRIVATE_PREFIXES.find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? ""] ?? "";

export function resolveSeo({ pathname, settings, siteUrl, indexingEnabled }: SeoContext): SeoMeta {
  const siteName = settings?.siteTitle.trim() || DEFAULT_TITLE;
  const siteDescription = truncateDescription(settings?.siteSubtitle || DEFAULT_DESCRIPTION);
  const absolute = (path: string) => (siteUrl ? `${siteUrl}${path}` : path);
  const base = {
    image: absolute(OG_IMAGE_PATH),
    imageAlt: `${siteName}: recuerdos, fechas especiales y notitas de amor`,
    type: "website" as const,
    locale: "es_CO" as const,
    siteName,
    structuredData: null,
  };

  if (pathname === "/") {
    // Si el sitio es privado (sólo con cuenta) no tiene sentido indexarlo.
    const indexable = indexingEnabled && (settings?.isPublic ?? false);
    return {
      ...base,
      title: siteName,
      description: siteDescription,
      robots: indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX,
      canonical: siteUrl ? `${siteUrl}/` : null,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        description: siteDescription,
        inLanguage: "es-CO",
        ...(siteUrl ? { url: `${siteUrl}/`, image: absolute(OG_IMAGE_PATH) } : {}),
        author: {
          "@type": "Person",
          name: AUTHOR.name,
          sameAs: Object.values(AUTHOR.links).filter(Boolean),
        },
      },
    };
  }

  if (isPrivatePath(pathname)) {
    return {
      ...base,
      title: `${privateTitle(pathname)} · ${siteName}`,
      description: siteDescription,
      robots: ROBOTS_NOINDEX,
      canonical: null,
    };
  }

  return {
    ...base,
    title: `Página no encontrada · ${siteName}`,
    description: siteDescription,
    robots: ROBOTS_NOINDEX,
    canonical: null,
  };
}

/** robots.txt: deja fuera las zonas privadas y apunta al sitemap. */
export function buildRobotsTxt(siteUrl: string, indexingEnabled: boolean): string {
  if (!indexingEnabled) return "User-agent: *\nDisallow: /\n";
  const lines = ["User-agent: *", "Allow: /$", ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`)];
  if (siteUrl) lines.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/** sitemap.xml con la única página pública (la portada). */
export function buildSitemapXml(siteUrl: string, lastModified: Date): string {
  const lastmod = lastModified.toISOString().slice(0, 10);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    "</urlset>",
    "",
  ].join("\n");
}
