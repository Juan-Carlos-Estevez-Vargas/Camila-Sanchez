import { useState } from "react";
import { Link } from "react-router-dom";
import { contrastRatio } from "@/core/validation";
import { DEFAULT_THEME } from "@/domain/defaults";
import { applyPalette, matchPalette, personalTheme, pickPalette, type PaletteKey } from "@/domain/palettes";
import type { ThemeTokens } from "@/domain/types";
import { ColorInput } from "@/features/admin/theme/ColorInput";
import { PalettePicker } from "@/features/admin/theme/PalettePicker";
import { ThemePreview } from "@/features/admin/theme/ThemePreview";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useSiteContent } from "@/state/SiteContentStore";

/** Los colores que tiene sentido ajustar a mano; el resto viene de la paleta. */
const CUSTOM_KEYS: Partial<Record<PaletteKey, string>> = {
  primary: "Color principal",
  accent: "Detalles",
  background: "Fondo",
  text: "Texto",
};

/** Mis colores: cada persona elige su paleta y sólo cambia lo que ve ella. */
export default function MyColorsPage() {
  const backend = useBackend();
  const { profile, refresh } = useAuth();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  const [customizing, setCustomizing] = useState(false);

  const site = content?.settings.theme ?? DEFAULT_THEME;
  const saved = personalTheme(site, profile?.themeColors);
  const theme = draft ?? saved;
  const selected = matchPalette(theme);
  const sitePalette = matchPalette(site);
  const textContrast = contrastRatio(theme.text, theme.background);
  const buttonContrast = contrastRatio(theme.primaryContrast, theme.primary);

  const save = async (colors: ThemeTokens | null, message: string) => {
    const ok = await run(() => backend.users.updateMyColors(colors && pickPalette(colors)).then(() => true), message);
    if (ok) {
      setDraft(null);
      await refresh();
    }
  };

  return (
    <main className="container stack" id="contenido-principal" style={{ maxWidth: 900, paddingBlock: "32px 64px" }}>
      <div className="row-between">
        <div>
          <p className="muted" style={{ margin: 0 }}><Link to="/cuenta">← Mi cuenta</Link></p>
          <h1 style={{ margin: "4px 0" }}>Mis colores</h1>
          <p className="muted" style={{ margin: 0 }}>
            Sólo cambian lo que ves tú. Los demás siguen viendo sus propios colores.
          </p>
        </div>
        <div className="row">
          {draft && <button className="btn btn--ghost" onClick={() => setDraft(null)}>Descartar</button>}
          <button className="btn" disabled={busy || !draft} onClick={() => void save(draft, "Tus colores quedaron guardados 🎨")}>
            {busy ? "Guardando…" : "Guardar mis colores"}
          </button>
        </div>
      </div>

      <div className="card stack" data-tour="my-colors">
        <div className="row-between">
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Paletas</h2>
          <span className="badge badge--muted">{selected ? `Elegida: ${selected.name}` : "Colores personalizados"}</span>
        </div>
        <PalettePicker selectedId={selected?.id ?? null} onSelect={(p) => setDraft(applyPalette(theme, p.colors))} />
        {profile?.themeColors && (
          <button className="btn btn--sm btn--soft" style={{ justifySelf: "start" }} disabled={busy}
            onClick={() => void save(null, "Volviste a los colores de la página")}>
            Volver a los colores de la página{sitePalette ? ` (${sitePalette.name})` : ""}
          </button>
        )}
      </div>

      <div className="form-grid" style={{ alignItems: "start" }}>
        <div className="card stack">
          <div className="row-between">
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Ajustar a mi gusto</h2>
            <button className="btn btn--sm btn--ghost" onClick={() => setCustomizing((v) => !v)} aria-expanded={customizing}>
              {customizing ? "Ocultar" : "Personalizar"}
            </button>
          </div>
          {customizing ? (
            <div className="form-grid">
              {(Object.entries(CUSTOM_KEYS) as [PaletteKey, string][]).map(([key, label]) => (
                <ColorInput key={`${key}-${theme[key]}`} label={label} value={theme[key]} onChange={(v) => setDraft(applyPalette(theme, { [key]: v }))} />
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Parte de una paleta y cambia el color que quieras.</p>
          )}
          {(textContrast < 4.5 || buttonContrast < 3) && (
            <p className="field__error" role="alert">
              ⚠️ Con estos colores {textContrast < 4.5 ? "el texto se lee poco sobre el fondo" : "el texto de los botones se lee poco"}.
            </p>
          )}
        </div>
        <ThemePreview theme={theme} />
      </div>
    </main>
  );
}
