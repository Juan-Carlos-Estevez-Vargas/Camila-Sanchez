/**
 * Aplica un SeoMeta al <head>. Actualiza las etiquetas que ya vienen en
 * index.html (o las crea) en lugar de duplicarlas, para que buscadores y
 * vistas previas de redes vean siempre una sola versión.
 */
import type { SeoMeta } from "@/core/seo";

const STRUCTURED_DATA_ID = "seo-structured-data";

function upsertMeta(attribute: "name" | "property", key: string, content: string | null): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (content === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function upsertCanonical(href: string | null): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = href;
}

function upsertStructuredData(data: Record<string, unknown> | null): void {
  let script = document.getElementById(STRUCTURED_DATA_ID);
  if (!data) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.id = STRUCTURED_DATA_ID;
    script.setAttribute("type", "application/ld+json");
    document.head.append(script);
  }
  // textContent (no innerHTML) y "<" escapado: nada del título puede cerrar el <script>.
  script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

export function applySeo(meta: SeoMeta, currentUrl: string): void {
  document.title = meta.title;
  upsertMeta("name", "description", meta.description);
  upsertMeta("name", "robots", meta.robots);
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", meta.description);
  upsertMeta("property", "og:type", meta.type);
  upsertMeta("property", "og:locale", meta.locale);
  upsertMeta("property", "og:site_name", meta.siteName);
  upsertMeta("property", "og:url", meta.canonical ?? currentUrl);
  const image = meta.image.startsWith("/") ? new URL(meta.image, currentUrl).href : meta.image;
  upsertMeta("property", "og:image", image);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", meta.title);
  upsertMeta("name", "twitter:description", meta.description);
  upsertMeta("name", "twitter:image", image);
  upsertMeta("name", "twitter:image:alt", meta.imageAlt);
  upsertMeta("property", "og:image:alt", meta.imageAlt);
  upsertCanonical(meta.canonical);
  upsertStructuredData(meta.structuredData);
}
