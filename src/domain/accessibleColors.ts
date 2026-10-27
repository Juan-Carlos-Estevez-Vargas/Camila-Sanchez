/**
 * Red de seguridad de contraste (WCAG 2.2 AA). Las paletas listas ya cumplen,
 * pero cualquiera puede elegir colores a mano en Mi cuenta o en Apariencia:
 * aquí se corrigen lo justo (acercándolos al negro o al blanco) para que el
 * texto siempre se pueda leer, sin cambiar el carácter de la paleta.
 */
import { contrastRatio } from "@/core/validation";
import type { ThemeTokens } from "./types";

/** Texto normal (1.4.3). */
export const TEXT_MIN = 4.5;
/** Bordes de foco y controles (1.4.11). */
export const UI_MIN = 3;

/** Neutros del modo oscuro (iguales a base/_tokens.scss). */
export const DARK_NEUTRALS = { background: "#15111a", surface: "#1f1925", text: "#f3e9ef", muted: "#b4a3ae" } as const;

function toRgb(hex: string): [number, number, number] {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** Mezcla `color` con `other` (0 = color, 1 = other), como color-mix en sRGB. */
export function mix(color: string, other: string, amount: number): string {
  const a = toRgb(color);
  const b = toRgb(other);
  return toHex(a.map((c, i) => c + (b[i]! - c) * amount));
}

const worstContrast = (color: string, backgrounds: string[]) =>
  Math.min(...backgrounds.map((bg) => contrastRatio(color, bg)));

/**
 * Devuelve `color` si ya contrasta `min` con todos los fondos; si no, lo
 * oscurece o aclara (hacia donde más contraste haya) lo mínimo necesario.
 */
export function ensureContrast(color: string, backgrounds: string[], min: number): string {
  if (worstContrast(color, backgrounds) >= min) return color.toLowerCase();
  const towards = worstContrast("#000000", backgrounds) >= worstContrast("#ffffff", backgrounds) ? "#000000" : "#ffffff";
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, towards, step / 20);
    if (worstContrast(candidate, backgrounds) >= min) return candidate;
  }
  return towards;
}

export interface ReadableColors {
  text: string;
  muted: string;
  primaryContrast: string;
  /** Color de los enlaces dentro del texto. */
  link: string;
  /** Anillo de foco del teclado. */
  focus: string;
}

/** Colores de texto y foco corregidos para el tema (claro u oscuro) que se va a pintar. */
export function readableColors(theme: ThemeTokens, dark: boolean): ReadableColors {
  const neutrals = dark ? DARK_NEUTRALS : theme;
  const { background, surface } = neutrals;
  // Las pestañas y tarjetas suaves pintan sobre la superficie con un 4 % del texto.
  const surface2 = mix(surface, neutrals.text, 0.04);
  const backgrounds = [background, surface, surface2];
  const text = ensureContrast(neutrals.text, backgrounds, TEXT_MIN);
  return {
    text,
    muted: ensureContrast(neutrals.muted, backgrounds, TEXT_MIN),
    primaryContrast: ensureContrast(theme.primaryContrast, [theme.primary], TEXT_MIN),
    link: ensureContrast(theme.primary, [background, surface], TEXT_MIN),
    focus: ensureContrast(theme.primary, [background, surface], UI_MIN),
  };
}
