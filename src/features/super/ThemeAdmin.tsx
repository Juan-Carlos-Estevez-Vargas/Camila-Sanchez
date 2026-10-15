import { useState, type CSSProperties } from "react";
import { contrastRatio, isHexColor } from "@/core/validation";
import { DEFAULT_EFFECTS, DEFAULT_THEME, FONT_OPTIONS, normalizeEffects, normalizeTheme, THEME_PRESETS } from "@/domain/defaults";
import type { EffectsConfig, ThemeTokens } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
// La vista previa reutiliza los estilos reales de la página.
import "@/features/site/styles/site.scss";

type ColorKey = "primary" | "primaryContrast" | "accent" | "background" | "surface" | "text" | "muted";

const COLOR_LABELS: Record<ColorKey, string> = {
  primary: "Color principal",
  primaryContrast: "Texto sobre el principal",
  accent: "Color de acento",
  background: "Fondo",
  surface: "Tarjetas",
  text: "Texto",
  muted: "Texto secundario",
};

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  const [text, setText] = useState(value);
  return (
    <Field label={label}>
      {(id) => (
        <div className="color-row">
          <input type="color" className="input" value={value} aria-label={label} onChange={(e) => { setText(e.target.value); onChange(e.target.value); }} />
          <input id={id} className="input" value={text} maxLength={7}
            onChange={(e) => { setText(e.target.value); if (isHexColor(e.target.value)) onChange(e.target.value); }} />
        </div>
      )}
    </Field>
  );
}

function Preview({ theme }: { theme: ThemeTokens }) {
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

export default function ThemeAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [theme, setTheme] = useState<ThemeTokens | null>(null);
  const [effects, setEffects] = useState<EffectsConfig | null>(null);
  const [emojiText, setEmojiText] = useState<string | null>(null);

  if (!content) return <PageLoader />;
  const t = theme ?? content.settings.theme;
  const fx = effects ?? content.settings.effects;
  const set = (patch: Partial<ThemeTokens>) => setTheme(normalizeTheme({ ...t, ...patch }));
  const setFx = (patch: Partial<EffectsConfig>) => setEffects(normalizeEffects({ ...fx, ...patch }));
  const textContrast = contrastRatio(t.text, t.background);
  const buttonContrast = contrastRatio(t.primaryContrast, t.primary);

  const save = async () => {
    const ok = await run(() => backend.content.updateSettings({ theme: t, effects: fx }), "Apariencia guardada 🎨");
    if (ok) {
      setTheme(null);
      setEffects(null);
      store.refresh("settings");
    }
  };

  return (
    <AdminPage title="Apariencia" description="Colores, tipografías, bordes, modo oscuro y efectos animados."
      actions={<>
        <button className="btn btn--ghost" onClick={() => { setTheme(DEFAULT_THEME); setEffects(DEFAULT_EFFECTS); }}>Restablecer</button>
        <button className="btn" disabled={busy || (!theme && !effects)} onClick={save}>Guardar cambios</button>
      </>}>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Paletas listas</h3>
        <div className="swatches">
          {Object.entries(THEME_PRESETS).map(([name, preset]) => (
            <button key={name} className="swatch" onClick={() => set({ ...DEFAULT_THEME, ...preset, fontDisplay: t.fontDisplay, fontBody: t.fontBody, radius: t.radius })}>
              <span className="swatch__dots">
                {[preset.primary, preset.accent, preset.background].map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Colores</h3>
          <div className="form-grid">
            {(Object.keys(COLOR_LABELS) as ColorKey[]).map((k) => (
              <ColorInput key={`${k}-${t[k]}`} label={COLOR_LABELS[k]} value={t[k]} onChange={(v) => set({ [k]: v })} />
            ))}
          </div>
          {(textContrast < 4.5 || buttonContrast < 3) && (
            <p className="field__error" role="alert">
              ⚠️ Poco contraste {textContrast < 4.5 ? `entre texto y fondo (${textContrast.toFixed(1)}:1)` : `en los botones (${buttonContrast.toFixed(1)}:1)`}. Puede costar leer.
            </p>
          )}
          <h3 style={{ margin: "8px 0 0" }}>Tipografía y forma</h3>
          <div className="form-grid">
            <Field label="Títulos">
              {(id) => <select id={id} className="select" value={t.fontDisplay} onChange={(e) => set({ fontDisplay: e.target.value })}>{FONT_OPTIONS.display.map((f) => <option key={f}>{f}</option>)}</select>}
            </Field>
            <Field label="Textos">
              {(id) => <select id={id} className="select" value={t.fontBody} onChange={(e) => set({ fontBody: e.target.value })}>{FONT_OPTIONS.body.map((f) => <option key={f}>{f}</option>)}</select>}
            </Field>
            <Field label={`Bordes redondeados (${t.radius}px)`}>
              {(id) => <input id={id} type="range" min={0} max={32} value={t.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />}
            </Field>
            <Field label="Modo oscuro">
              {(id) => (
                <select id={id} className="select" value={t.darkMode} onChange={(e) => set({ darkMode: e.target.value as ThemeTokens["darkMode"] })}>
                  <option value="auto">Automático (según el teléfono)</option>
                  <option value="light">Siempre claro</option>
                  <option value="dark">Siempre oscuro</option>
                </select>
              )}
            </Field>
          </div>
        </div>
        <Preview theme={t} />
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Efectos y dinamismo</h3>
        <Switch label="Emojis flotando en el fondo" checked={fx.floating.enabled} onChange={(enabled) => setFx({ floating: { ...fx.floating, enabled } })} />
        <div className="form-grid">
          <Field label="Emojis (separados por espacio)">
            {(id) => (
              <input id={id} className="input" value={emojiText ?? fx.floating.emojis.join(" ")}
                onChange={(e) => {
                  setEmojiText(e.target.value);
                  setFx({ floating: { ...fx.floating, emojis: e.target.value.split(/\s+/).filter(Boolean) } });
                }} />
            )}
          </Field>
          <Field label={`Cantidad (${fx.floating.density})`}>
            {(id) => <input id={id} type="range" min={0} max={40} value={fx.floating.density} onChange={(e) => setFx({ floating: { ...fx.floating, density: Number(e.target.value) } })} />}
          </Field>
        </div>
        <Switch label="Corazones que siguen el cursor" checked={fx.cursorHearts} onChange={(cursorHearts) => setFx({ cursorHearts })} />
        <Switch label="Menos efectos en teléfonos (más rápido)" checked={fx.reduceOnMobile} onChange={(reduceOnMobile) => setFx({ reduceOnMobile })} />
        <p className="muted" style={{ margin: 0 }}>La animación de entrada de cada sección se elige en Panel de contenido → Textos y animaciones.</p>
      </div>
    </AdminPage>
  );
}
