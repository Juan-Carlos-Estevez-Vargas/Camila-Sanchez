/**
 * Traducciones del contenido que se escribe en el panel (títulos, carta,
 * tarjetas, hitos, fechas…). El texto original es el español; cada fila
 * guarda en `translations` sólo lo traducido:
 *
 *   { "en": { "title": "For the love of my life" }, "pt": { … } }
 *
 * La página pinta la traducción del idioma activo y, donde falte, el
 * original. La traducción copia la forma del original (las mismas claves y
 * las mismas posiciones en las listas): nunca agrega ni quita tarjetas,
 * párrafos o deseos.
 */
import { DEFAULT_LOCALE as SOURCE_LOCALE, LOCALES, type Locale } from "@/i18n/locales";
import type { ImportantDate, Milestone, Section, SiteContent, SiteSettings } from "./types";

/** Idiomas a los que se traduce el contenido (todos menos el original). */
export type ContentLocale = Exclude<Locale, "es">;
export const CONTENT_LOCALES = LOCALES.map((l) => l.code).filter((c): c is ContentLocale => c !== SOURCE_LOCALE);

/** Lo traducido por idioma: un objeto con la misma forma que el original. */
export type ContentTranslations = Partial<Record<ContentLocale, Record<string, unknown>>>;

/** Campos que se traducen en cada tipo de contenido. */
export const TRANSLATABLE = {
  settings: ["siteTitle", "siteSubtitle"],
  section: ["title", "subtitle", "content"],
  milestone: ["title", "description"],
  date: ["title", "message"],
} as const satisfies Record<string, readonly string[]>;

/** Claves que nunca se traducen aunque sean texto (emojis, ids…). */
const UNTRANSLATABLE_KEYS = new Set(["icon", "id"]);
/** Tope por fila para que un JSON enorme no llegue a la página. */
const MAX_TRANSLATION_CHARS = 60_000;

export type Path = readonly (string | number)[];
export interface TextLeaf {
  path: Path;
  text: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Todos los textos con contenido del original, con su ruta. */
export function textLeaves(value: unknown, path: Path = []): TextLeaf[] {
  if (typeof value === "string") return value.trim() ? [{ path, text: value }] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => textLeaves(v, [...path, i]));
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([k]) => !UNTRANSLATABLE_KEYS.has(k))
      .flatMap(([k, v]) => textLeaves(v, [...path, k]));
  }
  return [];
}

/** Lee el valor en una ruta (o undefined). */
export function getAt(value: unknown, path: Path): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Copia `value` con `leaf` en la ruta indicada, creando lo que falte. */
export function setAt(value: unknown, path: Path, leaf: unknown): unknown {
  if (path.length === 0) return leaf;
  const [key, ...rest] = path;
  if (typeof key === "number") {
    const list = Array.isArray(value) ? [...value] : [];
    while (list.length < key) list.push(null);
    list[key] = setAt(list[key], rest, leaf);
    return list;
  }
  const record = isRecord(value) ? { ...value } : {};
  record[key!] = setAt(record[key!], rest, leaf);
  return record;
}

/**
 * El original con cada texto reemplazado por su traducción cuando la hay. La
 * forma la manda el original: lo que la traducción traiga de más se ignora.
 */
export function overlay<T>(source: T, translation: unknown): T {
  if (translation === undefined || translation === null) return source;
  if (typeof source === "string") {
    return (typeof translation === "string" && translation.trim() ? translation : source) as T;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(translation)) return source;
    return source.map((item, i) => overlay(item, translation[i])) as T;
  }
  if (isRecord(source)) {
    if (!isRecord(translation)) return source;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      out[k] = UNTRANSLATABLE_KEYS.has(k) ? v : overlay(v, translation[k]);
    }
    return out as T;
  }
  return source;
}

/** Limpia lo que llega de la base: sólo idiomas conocidos y objetos. */
export function normalizeTranslations(raw: unknown): ContentTranslations {
  if (!isRecord(raw)) return {};
  try {
    if (JSON.stringify(raw).length > MAX_TRANSLATION_CHARS) return {};
  } catch {
    return {};
  }
  const out: ContentTranslations = {};
  for (const locale of CONTENT_LOCALES) {
    const value = raw[locale];
    if (isRecord(value)) out[locale] = value;
  }
  return out;
}

/** Quita textos vacíos y listas que quedaron sin nada (lo que se guarda). */
export function pruneTranslation(value: unknown): unknown {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (Array.isArray(value)) {
    const items = value.map(pruneTranslation);
    return items.some((v) => v !== undefined) ? items.map((v) => v ?? null) : undefined;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).map(([k, v]) => [k, pruneTranslation(v)] as const).filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

/** Cuántos textos del original tienen traducción en ese idioma. */
export function translationProgress(source: unknown, translation: unknown): { done: number; total: number } {
  const leaves = textLeaves(source);
  const done = leaves.filter((l) => {
    const t = getAt(translation, l.path);
    return typeof t === "string" && t.trim() !== "";
  }).length;
  return { done, total: leaves.length };
}

/** Los campos traducibles de un elemento, como objeto (el "original"). */
export function translatableSource<T extends object>(item: T, fields: readonly (keyof T & string)[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f, item[f]]));
}

type Translatable = { translations?: ContentTranslations };

/** El elemento en el idioma pedido (en español, tal cual). */
export function localize<T extends Translatable>(item: T, locale: Locale, fields: readonly (keyof T & string)[]): T {
  if (locale === SOURCE_LOCALE) return item;
  const translation = item.translations?.[locale as ContentLocale];
  if (!translation) return item;
  const translated = overlay(translatableSource(item, fields), translation);
  return { ...item, ...translated };
}

/** Todo el contenido de la página en el idioma pedido. */
export function localizeContent(content: SiteContent, locale: Locale): SiteContent {
  if (locale === SOURCE_LOCALE) return content;
  return {
    ...content,
    settings: localize<SiteSettings>(content.settings, locale, TRANSLATABLE.settings),
    sections: content.sections.map((s) => localize<Section>(s, locale, TRANSLATABLE.section as readonly (keyof Section & string)[])),
    milestones: content.milestones.map((m) => localize<Milestone>(m, locale, TRANSLATABLE.milestone)),
    dates: content.dates.map((d) => localize<ImportantDate>(d, locale, TRANSLATABLE.date)),
  };
}
