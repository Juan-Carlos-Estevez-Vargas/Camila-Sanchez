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
import { useT } from "@/i18n";

type ColorKey = "primary" | "primaryContrast" | "accent" | "background" | "surface" | "text" | "muted";

const COLOR_KEYS: ColorKey[] = ["primary", "primaryContrast", "accent", "background", "surface", "text", "muted"];

export default function ThemeAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [theme, setTheme] = useState<ThemeTokens | null>(null);
  const [effects, setEffects] = useState<EffectsConfig | null>(null);
  const [emojiText, setEmojiText] = useState<string | null>(null);
  const tx = useT().superAdmin.theme;

  if (!content) return <PageLoader />;
  const t = theme ?? content.settings.theme;
  const fx = effects ?? content.settings.effects;
  const set = (patch: Partial<ThemeTokens>) => setTheme(normalizeTheme({ ...t, ...patch }));
  const setFx = (patch: Partial<EffectsConfig>) => setEffects(normalizeEffects({ ...fx, ...patch }));
  const textContrast = contrastRatio(t.text, t.background);
  const buttonContrast = contrastRatio(t.primaryContrast, t.primary);

  const save = async () => {
    const ok = await run(() => backend.content.updateSettings({ theme: t, effects: fx }), tx.saved);
    if (ok) {
      setTheme(null);
      setEffects(null);
      store.refresh("settings");
    }
  };

  return (
    <AdminPage title={tx.title} description={tx.description}
      actions={<>
        <button className="btn btn--ghost" onClick={() => { setTheme(DEFAULT_THEME); setEffects(DEFAULT_EFFECTS); }}>{tx.reset}</button>
        <button className="btn" disabled={busy || (!theme && !effects)} onClick={save}>{tx.save}</button>
      </>}>
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{tx.palettes}</h2>
        <p className="muted" style={{ margin: 0 }}>{tx.palettesHint}</p>
        <PalettePicker selectedId={matchPalette(t)?.id ?? null} onSelect={(p) => set(applyPalette(t, p.colors))} />
      </div>

      <div className="form-grid" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{tx.colors}</h2>
          <div className="form-grid">
            {COLOR_KEYS.map((k) => (
              <ColorInput key={`${k}-${t[k]}`} label={tx.colorLabels[k]} value={t[k]} onChange={(v) => set({ [k]: v })} />
            ))}
          </div>
          {(textContrast < 4.5 || buttonContrast < 3) && (
            <p className="field__error" role="alert">
              {textContrast < 4.5 ? tx.lowText(textContrast.toFixed(1)) : tx.lowButtons(buttonContrast.toFixed(1))}
            </p>
          )}
          <h2 style={{ margin: "8px 0 0", fontSize: "1.25rem" }}>{tx.typography}</h2>
          <div className="form-grid">
            <Field label={tx.headings}>
              {(id) => <select id={id} className="select" value={t.fontDisplay} onChange={(e) => set({ fontDisplay: e.target.value })}>{FONT_OPTIONS.display.map((f) => <option key={f}>{f}</option>)}</select>}
            </Field>
            <Field label={tx.body}>
              {(id) => <select id={id} className="select" value={t.fontBody} onChange={(e) => set({ fontBody: e.target.value })}>{FONT_OPTIONS.body.map((f) => <option key={f}>{f}</option>)}</select>}
            </Field>
            <Field label={tx.radius(t.radius)}>
              {(id) => <input id={id} type="range" min={0} max={32} value={t.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />}
            </Field>
            <Field label={tx.darkMode}>
              {(id) => (
                <select id={id} className="select" value={t.darkMode} onChange={(e) => set({ darkMode: e.target.value as ThemeTokens["darkMode"] })}>
                  <option value="auto">{tx.darkAuto}</option>
                  <option value="light">{tx.darkLight}</option>
                  <option value="dark">{tx.darkDark}</option>
                </select>
              )}
            </Field>
          </div>
        </div>
        <ThemePreview theme={t} />
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{tx.effects}</h2>
        <Switch label={tx.floating} checked={fx.floating.enabled} onChange={(enabled) => setFx({ floating: { ...fx.floating, enabled } })} />
        <div className="form-grid">
          <Field label={tx.emojis}>
            {(id) => (
              <input id={id} className="input" value={emojiText ?? fx.floating.emojis.join(" ")}
                onChange={(e) => {
                  setEmojiText(e.target.value);
                  setFx({ floating: { ...fx.floating, emojis: e.target.value.split(/\s+/).filter(Boolean) } });
                }} />
            )}
          </Field>
          <Field label={tx.density(fx.floating.density)}>
            {(id) => <input id={id} type="range" min={0} max={40} value={fx.floating.density} onChange={(e) => setFx({ floating: { ...fx.floating, density: Number(e.target.value) } })} />}
          </Field>
        </div>
        <Switch label={tx.cursorHearts} checked={fx.cursorHearts} onChange={(cursorHearts) => setFx({ cursorHearts })} />
        <Switch label={tx.reduceOnMobile} checked={fx.reduceOnMobile} onChange={(reduceOnMobile) => setFx({ reduceOnMobile })} />
        <p className="muted" style={{ margin: 0 }}>{tx.animationsHint}</p>
      </div>
    </AdminPage>
  );
}
