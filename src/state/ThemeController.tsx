import { useEffect, useState } from "react";
import { readableColors } from "@/domain/accessibleColors";
import { DEFAULT_THEME } from "@/domain/defaults";
import type { ThemeTokens } from "@/domain/types";
import { useCookieChoice } from "@/services/consent/cookieConsent";

const LOADED_FONTS = new Set<string>();

/** Las de siempre se piden con más pesos (y el eje óptico de Fraunces). */
const FONT_QUERIES: Record<string, string> = {
  Fraunces: "Fraunces:opsz,wght@9..144,400;9..144,600",
  Inter: "Inter:wght@400;500;600",
};

/**
 * Carga bajo demanda una familia de Google Fonts (ya validada). Sólo se
 * llama si la persona aceptó las tipografías externas en el aviso de
 * cookies: así ningún dato sale hacia Google sin su permiso. Sin eso se
 * usan las fuentes del sistema que hay detrás de cada familia en el CSS.
 */
function ensureFont(family: string) {
  if (LOADED_FONTS.has(family)) return;
  LOADED_FONTS.add(family);
  // safeFontFamily ya dejó sólo letras, números y espacios.
  const query = FONT_QUERIES[family] ?? `${family.replace(/ /g, "+")}:wght@400;600`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  document.head.appendChild(link);
}

function usePrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    const mql = matchMedia(query);
    const onChange = () => setDark(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/**
 * Aplica el tema como variables CSS en :root. Los valores ya vienen
 * validados (normalizeTheme), así que nunca se inyecta CSS arbitrario.
 */
export function ThemeController({ theme = DEFAULT_THEME }: { theme?: ThemeTokens }) {
  const prefersDark = usePrefersDark();
  const externalFonts = useCookieChoice()?.externalFonts ?? false;
  const dark = theme.darkMode === "dark" || (theme.darkMode === "auto" && prefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    // Colores de texto y foco corregidos si no alcanzan el contraste AA.
    const readable = readableColors(theme, dark);
    const vars: Record<string, string> = {
      "--c-primary": theme.primary,
      "--c-primary-contrast": readable.primaryContrast,
      "--c-link": readable.link,
      "--c-focus": readable.focus,
      "--c-accent": theme.accent,
      "--font-display": `"${theme.fontDisplay}", Georgia, serif`,
      "--font-body": `"${theme.fontBody}", system-ui, sans-serif`,
      "--radius": `${theme.radius}px`,
    };
    // En modo oscuro dejamos que el CSS ponga los neutros oscuros.
    const neutrals: Record<string, string> = {
      "--c-bg": theme.background,
      "--c-surface": theme.surface,
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(neutrals).forEach(([k, v]) => (dark ? root.style.removeProperty(k) : root.style.setProperty(k, v)));
    root.style.setProperty("--c-text", readable.text);
    root.style.setProperty("--c-muted", readable.muted);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.primary);
  }, [theme, dark]);

  useEffect(() => {
    if (!externalFonts) return;
    ensureFont(theme.fontDisplay);
    ensureFont(theme.fontBody);
  }, [externalFonts, theme.fontDisplay, theme.fontBody]);

  return null;
}
