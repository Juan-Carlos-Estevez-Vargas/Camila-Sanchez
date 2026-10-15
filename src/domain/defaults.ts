import {
  asStringArray, clampNumber, isSafeUrl, safeColor, safeFontFamily, trimTo,
} from "@/core/validation";
import {
  SECTION_ANIMATIONS, type EffectsConfig, type Section, type SectionAnimation,
  type SectionContentMap, type SectionKind, type ThemeTokens,
} from "./types";

export const DEFAULT_THEME: ThemeTokens = {
  primary: "#b0305a",
  primaryContrast: "#ffffff",
  accent: "#e8a33d",
  background: "#fff8f6",
  surface: "#ffffff",
  text: "#2b1720",
  muted: "#7a5c66",
  fontDisplay: "Fraunces",
  fontBody: "Inter",
  radius: 18,
  darkMode: "auto",
};

export const DEFAULT_EFFECTS: EffectsConfig = {
  floating: { enabled: true, emojis: ["❤️", "💖", "🌸", "🌷", "✨"], density: 14 },
  cursorHearts: false,
  reduceOnMobile: true,
};

/** Paletas listas para el editor de apariencia. */
export const THEME_PRESETS: Record<string, Partial<ThemeTokens>> = {
  "Rosa vino": { primary: "#b0305a", accent: "#e8a33d", background: "#fff8f6", text: "#2b1720", muted: "#7a5c66" },
  "Lavanda": { primary: "#6b4fa0", accent: "#e88aa8", background: "#faf7ff", text: "#231a33", muted: "#6c6180" },
  "Atardecer": { primary: "#c4512b", accent: "#f2b544", background: "#fff9f2", text: "#2e1a12", muted: "#7f6152" },
  "Bosque": { primary: "#2f6b4f", accent: "#d9a441", background: "#f6faf6", text: "#16241d", muted: "#5b6f63" },
  "Medianoche": { primary: "#e05a84", accent: "#f0c674", background: "#16121c", surface: "#211b29", text: "#f4eaf0", muted: "#b3a2ad" },
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

export const SECTION_KIND_LABELS: Record<SectionKind, { label: string; icon: string; description: string }> = {
  hero: { label: "Portada", icon: "💖", description: "Título grande de bienvenida" },
  together_counter: { label: "Tiempo juntos", icon: "⏳", description: "Contador desde que empezó la relación" },
  countdowns: { label: "Cuenta regresiva", icon: "📅", description: "Faltan X días para fechas importantes" },
  love_notes: { label: "Tarjetas de amor", icon: "💌", description: "Mensajes cortos en tarjetas" },
  milestones: { label: "Hitos", icon: "🌟", description: "Línea de tiempo de momentos importantes" },
  gallery: { label: "Galería", icon: "📸", description: "Fotos por año y mes" },
  letter: { label: "Carta", icon: "✉️", description: "Carta larga con sorpresa opcional" },
  text: { label: "Texto libre", icon: "📝", description: "Un bloque de texto" },
  quote: { label: "Frase", icon: "❝", description: "Una cita destacada" },
};

export function emptySection(kind: SectionKind, position: number): Omit<Section, "id"> {
  return {
    kind,
    title: SECTION_KIND_LABELS[kind].label,
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
