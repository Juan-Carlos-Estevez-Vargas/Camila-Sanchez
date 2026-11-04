import {
  asStringArray, clampNumber, isSafeUrl, safeColor, safeFontFamily, trimTo,
} from "@/core/validation";
import {
  SECTION_ANIMATIONS, type EffectsConfig, type Section, type SectionAnimation,
  type SectionContentMap, type SectionKind, type ThemeTokens,
} from "./types";
import { WINE_PALETTE } from "./palettes";
import { msg } from "@/i18n/store";

/** Tema de fábrica: los colores suaves de la versión 1, siempre en modo claro. */
export const DEFAULT_THEME: ThemeTokens = {
  ...WINE_PALETTE.colors,
  fontDisplay: "Fraunces",
  fontBody: "Inter",
  radius: 18,
  darkMode: "light",
};

export const DEFAULT_EFFECTS: EffectsConfig = {
  floating: { enabled: true, emojis: ["❤️", "💖", "🌸", "🌷", "✨"], density: 14 },
  cursorHearts: false,
  reduceOnMobile: true,
};

export const FONT_OPTIONS = {
  display: ["Fraunces", "Playfair Display", "Cormorant Garamond", "Dancing Script", "Inter"],
  body: ["Inter", "Nunito", "Lora", "Source Sans 3"],
} as const;

const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Normaliza el JSON de tema: cualquier valor inválido vuelve al de fábrica. */
export function normalizeTheme(raw: unknown): ThemeTokens {
  const t = object(raw);
  const d = DEFAULT_THEME;
  const darkMode = t.darkMode === "light" || t.darkMode === "dark" ? t.darkMode : "auto";
  return {
    primary: safeColor(t.primary, d.primary),
    primaryContrast: safeColor(t.primaryContrast, d.primaryContrast),
    accent: safeColor(t.accent, d.accent),
    background: safeColor(t.background, d.background),
    surface: safeColor(t.surface, d.surface),
    text: safeColor(t.text, d.text),
    muted: safeColor(t.muted, d.muted),
    fontDisplay: safeFontFamily(t.fontDisplay, d.fontDisplay),
    fontBody: safeFontFamily(t.fontBody, d.fontBody),
    radius: clampNumber(t.radius, 0, 40, d.radius),
    darkMode,
  };
}

export function normalizeEffects(raw: unknown): EffectsConfig {
  const e = object(raw);
  const floating = object(e.floating);
  const emojis = asStringArray(floating.emojis, 12, 16);
  return {
    floating: {
      enabled: floating.enabled !== false,
      emojis: emojis.length ? emojis : DEFAULT_EFFECTS.floating.emojis,
      density: clampNumber(floating.density, 0, 40, DEFAULT_EFFECTS.floating.density),
    },
    cursorHearts: e.cursorHearts === true,
    reduceOnMobile: e.reduceOnMobile !== false,
  };
}

export function normalizeAnimation(raw: unknown): SectionAnimation {
  return (SECTION_ANIMATIONS as readonly string[]).includes(raw as string)
    ? (raw as SectionAnimation)
    : "fade-up";
}

/** Contenido por defecto y normalizador de cada tipo de sección. */
export function normalizeSectionContent<K extends SectionKind>(kind: K, raw: unknown): SectionContentMap[K] {
  const c = object(raw);
  const content: { [P in SectionKind]: () => SectionContentMap[P] } = {
    hero: () => ({}),
    together_counter: () => ({}),
    countdowns: () => ({}),
    milestones: () => ({}),
    gallery: () => ({}),
    love_notes: () => ({
      cards: (Array.isArray(c.cards) ? c.cards : []).slice(0, 24).map((card) => {
        const o = object(card);
        return { icon: trimTo(o.icon, 16) || "💗", title: trimTo(o.title, 160), body: trimTo(o.body, 2000) };
      }),
    }),
    letter: () => {
      const s = object(c.surprise);
      return {
        greeting: trimTo(c.greeting, 200),
        paragraphs: asStringArray(c.paragraphs, 20, 4000),
        wishes: asStringArray(c.wishes, 20, 300),
        signature: trimTo(c.signature, 200),
        surprise: c.surprise
          ? { button: trimTo(s.button, 80) || "Abrir sorpresa", title: trimTo(s.title, 160), text: trimTo(s.text, 2000) }
          : null,
      };
    },
    text: () => ({ body: trimTo(c.body, 8000) }),
    quote: () => ({ text: trimTo(c.text, 1000), author: trimTo(c.author, 160) }),
  };
  return content[kind]() as SectionContentMap[K];
}

const SECTION_KIND_ICONS: Record<SectionKind, string> = {
  hero: "💖", together_counter: "⏳", countdowns: "📅", love_notes: "💌", milestones: "🌟",
  gallery: "📸", letter: "✉️", text: "📝", quote: "❝",
};

/** Icono, nombre y descripción de cada tipo de sección, en el idioma actual. */
export function sectionKindMeta(kind: SectionKind): { label: string; icon: string; description: string } {
  return { icon: SECTION_KIND_ICONS[kind], ...msg().admin.sections[kind] };
}

export function emptySection(kind: SectionKind, position: number): Omit<Section, "id"> {
  return {
    kind,
    title: sectionKindMeta(kind).label,
    subtitle: "",
    animation: "fade-up",
    position,
    isVisible: true,
    content: normalizeSectionContent(kind, {}),
  } as Omit<Section, "id">;
}

export function safeMusicUrl(value: unknown): string | null {
  return isSafeUrl(value) && String(value).startsWith("https://") ? String(value) : null;
}
