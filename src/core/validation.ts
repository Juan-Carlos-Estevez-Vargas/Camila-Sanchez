/**
 * Validación y normalización de datos que vienen de la base de datos o de
 * formularios. Todo lo que termina en CSS o en un atributo src pasa por aquí
 * para evitar inyecciones (p. ej. `url(javascript:...)` en un color).
 */

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const SAFE_FONT = /^[\p{L}\p{N} -]{1,40}$/u;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function safeColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

export function safeFontFamily(value: unknown, fallback: string): string {
  return typeof value === "string" && SAFE_FONT.test(value) ? value : fallback;
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Sólo https:// absolutos o rutas relativas al propio sitio. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function trimTo(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function asStringArray(value: unknown, maxItems = 50, maxLength = 500): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").slice(0, maxItems).map((v) => v.slice(0, maxLength))
    : [];
}

/** Relación de contraste WCAG entre dos colores hex. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const channels = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}
