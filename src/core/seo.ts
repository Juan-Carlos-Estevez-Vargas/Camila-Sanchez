/**
 * SEO como datos: a partir de la ruta y los ajustes del sitio decide título,
 * descripción, robots, URL canónica, etiquetas Open Graph y datos
 * estructurados. Es puro (sin DOM) para poder probarlo; quien lo aplica al
 * <head> es services/seo/head.ts.
 */
import { AUTHOR } from "./author.ts";
import { LEGAL_DOCUMENTS, LEGAL_PATH } from "../domain/legal.ts";
import type { SiteSettings } from "@/domain/types";

export const DEFAULT_TITLE = "Nuestro rincón";
export const DEFAULT_DESCRIPTION = "Nuestros recuerdos, fechas especiales, notitas y chat: una página hecha con amor.";
export const OG_IMAGE_PATH = "/og-image.jpg";
export const DESCRIPTION_MAX = 160;

/** Página pública para instalar la app en el celular. */
export const INSTALL_PATH = "/app";

/** Rutas que nunca deben aparecer en buscadores. */
export const PRIVATE_PREFIXES = ["/entrar", "/invitacion", "/recuperar", "/cuenta", "/panel", "/super", "/mensajes", "/chat", "/listas", "/dedicatorias"] as const;

const PAGE_TITLES: Record<string, string> = {
  "/entrar": "Entrar",
  "/invitacion": "Invitación",
  "/recuperar": "Recuperar contraseña",
  "/cuenta": "Mi cuenta",
  "/mensajes": "Cajita de mensajes",
  "/chat": "Chat",
  "/listas": "Listas",
  "/dedicatorias": "Dedicatorias",
  "/panel": "Mi panel",
  "/super": "Administración",
};

/**
 * Textos de SEO en el idioma activo. Este módulo también lo usa el build
 * (vite.config.ts), así que no importa el diccionario: lo recibe. Sin
 * textos, todo sale en español (lo que ven WhatsApp y los buscadores en el
 * index.html, que no ejecutan JavaScript).
 */
export interface SeoTexts {
  defaultTitle: string;
  defaultDescription: string;
  imageAlt(siteName: string): string;
  pageTitles: Record<string, string>;
  legalIndexTitle: string;
  legalIndexDescription: string;
  legalDocs: Record<string, { title: string; summary: string }>;
  installTitle: string;
  installDescription: string;
  notFound: string;
  /** es-CO, en-US… */
  languageTag: string;
  /** es_CO, en_US… */
  ogLocale: string;
}

export const SPANISH_SEO: SeoTexts = {
  defaultTitle: DEFAULT_TITLE,
  defaultDescription: DEFAULT_DESCRIPTION,
  imageAlt: (siteName) => `${siteName}: recuerdos, fechas especiales y notitas de amor`,
  pageTitles: PAGE_TITLES,
  legalIndexTitle: "Legal y privacidad",
  legalIndexDescription: "Términos, privacidad, cookies, cobros y licencias de la app.",
  legalDocs: Object.fromEntries(LEGAL_DOCUMENTS.map((d) => [d.id, { title: d.title, summary: d.summary }])),
  installTitle: "Descarga la app",
  installDescription: "Instala Nuestro rincón en tu celular o computador: ícono en la pantalla de inicio, pantalla completa, avisos y sin conexión.",
  notFound: "Página no encontrada",
  languageTag: "es-CO",
  ogLocale: "es_CO",
};

/** Título de una página legal (/legal o /legal/<documento>), o null si no lo es. */
function legalTitle(pathname: string, texts: SeoTexts): string | null {
  if (pathname === LEGAL_PATH) return texts.legalIndexTitle;
  const doc = LEGAL_DOCUMENTS.find((d) => pathname === `${LEGAL_PATH}/${d.id}`);
  return doc ? texts.legalDocs[doc.id]?.title ?? doc.title : null;
}

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
  locale: string;
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
  /** Textos del idioma activo; por defecto, español. */
  texts?: SeoTexts;
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

const privateTitle = (pathname: string, texts: SeoTexts) =>
  texts.pageTitles[PRIVATE_PREFIXES.find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? ""] ?? "";

export function resolveSeo({ pathname, settings, siteUrl, indexingEnabled, texts = SPANISH_SEO }: SeoContext): SeoMeta {
  const siteName = settings?.siteTitle.trim() || texts.defaultTitle;
  const siteDescription = truncateDescription(settings?.siteSubtitle || texts.defaultDescription);
  const absolute = (path: string) => (siteUrl ? `${siteUrl}${path}` : path);
  const base = {
    image: absolute(OG_IMAGE_PATH),
    imageAlt: texts.imageAlt(siteName),
    type: "website" as const,
    locale: texts.ogLocale,
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
        inLanguage: texts.languageTag,
        ...(siteUrl ? { url: `${siteUrl}/`, image: absolute(OG_IMAGE_PATH) } : {}),
        author: {
          "@type": "Person",
          name: AUTHOR.name,
          sameAs: Object.values(AUTHOR.links).filter(Boolean),
        },
      },
    };
  }

  const legal = legalTitle(pathname, texts);
  if (legal) {
    // Públicas aunque la página sea privada: cualquiera debe poder leerlas.
    return {
      ...base,
      title: `${legal} · ${siteName}`,
      description: truncateDescription(texts.legalDocs[pathname.slice(LEGAL_PATH.length + 1)]?.summary ?? texts.legalIndexDescription),
      robots: indexingEnabled ? ROBOTS_INDEX : ROBOTS_NOINDEX,
      canonical: siteUrl ? `${siteUrl}${pathname}` : null,
    };
  }

  if (pathname === INSTALL_PATH) {
    // Como la portada: sólo se indexa si el sitio es público.
    const indexable = indexingEnabled && (settings?.isPublic ?? false);
    return {
      ...base,
      title: `${texts.installTitle} · ${siteName}`,
      description: truncateDescription(texts.installDescription),
      robots: indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX,
      canonical: siteUrl ? `${siteUrl}${INSTALL_PATH}` : null,
    };
  }

  if (isPrivatePath(pathname)) {
    return {
      ...base,
      title: `${privateTitle(pathname, texts)} · ${siteName}`,
      description: siteDescription,
      robots: ROBOTS_NOINDEX,
      canonical: null,
    };
  }

  return {
    ...base,
    title: `${texts.notFound} · ${siteName}`,
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
