import type { CSSProperties } from "react";
import type { ThemeTokens } from "@/domain/types";
// La vista previa reutiliza los estilos reales de la página.
import "@/features/site/styles/site.scss";

/** Muestra cómo se verán textos, tarjetas y botones con un tema. */
export function ThemePreview({ theme }: { theme: ThemeTokens }) {
  const style = {
    "--c-primary": theme.primary,
    "--c-primary-contrast": theme.primaryContrast,
    "--c-accent": theme.accent,
    "--c-bg": theme.background,
    "--c-surface": theme.surface,
    "--c-text": theme.text,
    "--c-muted": theme.muted,
    "--radius": `${theme.radius}px`,
    "--font-display": `"${theme.fontDisplay}", Georgia, serif`,
    "--font-body": `"${theme.fontBody}", system-ui, sans-serif`,
    background: theme.background,
    color: theme.text,
    fontFamily: "var(--font-body)",
  } as CSSProperties;
  return (
    <div className="preview" style={style} aria-label="Vista previa">
      <span className="section-heading__eyebrow" style={{ margin: 0 }}>Vista previa</span>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Para el amor de mi vida</h2>
      <p style={{ margin: 0, color: theme.muted }}>Así se verán los textos, las tarjetas y los botones.</p>
      <div className="card" style={{ background: theme.surface }}>
        <strong style={{ color: theme.primary, fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>228 días</strong>
        <div style={{ color: theme.muted }}>para nuestro aniversario</div>
      </div>
      <div className="row"><button className="btn" type="button">Botón principal</button><button className="btn btn--soft" type="button">Secundario</button></div>
    </div>
  );
}
