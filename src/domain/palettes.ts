/**
 * Paletas de colores. Cada persona con cuenta elige la suya en Mi cuenta y
 * sólo cambia lo que ve ella. Los colores de la página (los que ve quien
 * entra sin cuenta), las tipografías, los bordes, el modo oscuro y los
 * efectos son cosa del super administrador.
 */
import type { ThemeTokens } from "./types";

export const PALETTE_KEYS = ["primary", "primaryContrast", "accent", "background", "surface", "text", "muted"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type PaletteColors = Pick<ThemeTokens, PaletteKey>;

export interface Palette {
  id: string;
  name: string;
  description: string;
  colors: PaletteColors;
}

/** Los colores suaves de la primera versión de la página. Es la paleta por defecto. */
export const V1_PALETTE: Palette = {
  id: "rosa-suave",
  name: "Rosa suave",
  description: "La de la primera versión: rosado pastel y fucsia.",
  colors: {
    primary: "#c2185b",
    primaryContrast: "#ffffff",
    accent: "#ff4081",
    background: "#ffe6ec",
    surface: "#fff7f9",
    text: "#880e4f",
    muted: "#ad1457",
  },
};

/** La paleta de la página para quien entra sin cuenta. */
export const WINE_PALETTE: Palette = {
  id: "rosa-vino",
  name: "Rosa vino",
  description: "Más elegante y sobria.",
  colors: { primary: "#b0305a", primaryContrast: "#ffffff", accent: "#e8a33d", background: "#fff8f6", surface: "#ffffff", text: "#2b1720", muted: "#7a5c66" },
};

export const PALETTES: readonly Palette[] = [
  WINE_PALETTE,
  V1_PALETTE,
  {
    id: "durazno",
    name: "Durazno",
    description: "Cálida y suave, como un atardecer.",
    colors: { primary: "#b9473d", primaryContrast: "#ffffff", accent: "#f4a261", background: "#fff1ea", surface: "#fffaf7", text: "#6b2e26", muted: "#8f4c42" },
  },
  {
    id: "lavanda",
    name: "Lavanda",
    description: "Lila tranquila con toques rosados.",
    colors: { primary: "#7e4fb5", primaryContrast: "#ffffff", accent: "#f19ec2", background: "#f6f0ff", surface: "#fdfbff", text: "#3d2563", muted: "#66558a" },
  },
  {
    id: "menta",
    name: "Menta",
    description: "Verde fresco con detalles en rosa.",
    colors: { primary: "#23735f", primaryContrast: "#ffffff", accent: "#f2a5b8", background: "#ecf8f3", surface: "#fbfefd", text: "#1d4a3f", muted: "#456f63" },
  },
  {
    id: "cielo",
    name: "Cielo",
    description: "Azul claro y sereno.",
    colors: { primary: "#2f6aad", primaryContrast: "#ffffff", accent: "#f7b2c4", background: "#eef5fd", surface: "#fbfdff", text: "#1f3a5c", muted: "#4d6787" },
  },
  {
    id: "medianoche",
    name: "Medianoche",
    description: "Oscura, para ver de noche.",
    colors: { primary: "#e05a84", primaryContrast: "#1c0d15", accent: "#f0c674", background: "#16121c", surface: "#211b29", text: "#f4eaf0", muted: "#b3a2ad" },
  },
];

export function pickPalette(theme: ThemeTokens): PaletteColors {
  return Object.fromEntries(PALETTE_KEYS.map((k) => [k, theme[k]])) as PaletteColors;
}

/** Aplica sólo los colores; conserva tipografías, bordes y modo oscuro. */
export function applyPalette(theme: ThemeTokens, colors: Partial<PaletteColors>): ThemeTokens {
  return { ...theme, ...colors };
}

/** ¿Qué paleta lista coincide con los colores actuales? (null = personalizada) */
export function matchPalette(theme: ThemeTokens): Palette | null {
  return PALETTES.find((p) => PALETTE_KEYS.every((k) => p.colors[k].toLowerCase() === theme[k].toLowerCase())) ?? null;
}

/** ¿El cambio entre dos temas toca algo más que los colores? */
export function changesBeyondPalette(before: ThemeTokens, after: ThemeTokens): boolean {
  return (Object.keys(after) as (keyof ThemeTokens)[]).some(
    (k) => !(PALETTE_KEYS as readonly string[]).includes(k) && after[k] !== before[k],
  );
}

/**
 * Colores propios de una persona, limpios: sólo claves de la paleta y en
 * formato #rrggbb (igual que la base de datos). Lo que no cumpla se descarta (null = usa los de la página).
 */
export function sanitizeColors(value: unknown): Partial<PaletteColors> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const clean: Partial<PaletteColors> = {};
  for (const k of PALETTE_KEYS) {
    const color = source[k];
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) clean[k] = color;
  }
  return Object.keys(clean).length ? clean : null;
}

/** El tema que ve cada persona: el de la página con sus colores encima. */
export function personalTheme(site: ThemeTokens, colors: Partial<PaletteColors> | null | undefined): ThemeTokens {
  const clean = sanitizeColors(colors);
  return clean ? applyPalette(site, clean) : site;
}
