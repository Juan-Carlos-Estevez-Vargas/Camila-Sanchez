import { useState } from "react";
import { contrastRatio } from "@/core/validation";
import { DEFAULT_EFFECTS, DEFAULT_THEME, FONT_OPTIONS, normalizeEffects, normalizeTheme } from "@/domain/defaults";
import { applyPalette, matchPalette } from "@/domain/palettes";
import type { EffectsConfig, ThemeTokens } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
import { ColorInput } from "@/features/admin/theme/ColorInput";
import { PalettePicker } from "@/features/admin/theme/PalettePicker";
import { ThemePreview } from "@/features/admin/theme/ThemePreview";

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
        <p className="muted" style={{ margin: 0 }}>Camila también puede cambiar la paleta desde su panel.</p>
        <PalettePicker selectedId={matchPalette(t)?.id ?? null} onSelect={(p) => set(applyPalette(t, p.colors))} />
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
        <ThemePreview theme={t} />
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
