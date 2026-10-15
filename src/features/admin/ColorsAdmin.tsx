import { useState } from "react";
import { contrastRatio } from "@/core/validation";
import { applyPalette, matchPalette, V1_PALETTE, type PaletteKey } from "@/domain/palettes";
import type { ThemeTokens } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { PageLoader } from "@/ui/Feedback";
import { AdminPage } from "./AdminLayout";
import { ColorInput } from "./theme/ColorInput";
import { PalettePicker } from "./theme/PalettePicker";
import { ThemePreview } from "./theme/ThemePreview";
import { useSaver } from "./useSaver";

/** Los colores que tiene sentido ajustar a mano; el resto viene de la paleta. */
const CUSTOM_KEYS: Partial<Record<PaletteKey, string>> = {
  primary: "Color principal",
  accent: "Detalles",
  background: "Fondo",
  text: "Texto",
};

/** Panel de Camila: elegir la paleta de colores de la página. */
export default function ColorsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  const [customizing, setCustomizing] = useState(false);

  if (!content) return <PageLoader />;
  const saved = content.settings.theme;
  const theme = draft ?? saved;
  const selected = matchPalette(theme);
  const textContrast = contrastRatio(theme.text, theme.background);
  const buttonContrast = contrastRatio(theme.primaryContrast, theme.primary);

  const save = async () => {
    if (!draft) return;
    const ok = await run(() => backend.content.updateSettings({ theme: draft }), "Colores guardados 🎨");
    if (ok) {
      setDraft(null);
      store.refresh("settings");
    }
  };

  return (
    <AdminPage
      title="Colores"
      description="Elige la paleta de la página. Puedes cambiarla cuando quieras."
      actions={<>
        {draft && <button className="btn btn--ghost" onClick={() => setDraft(null)}>Descartar</button>}
        <button className="btn" disabled={busy || !draft} onClick={save}>{busy ? "Guardando…" : "Guardar colores"}</button>
      </>}
    >
      <div className="card stack">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Paletas</h3>
          <span className="badge badge--muted">{selected ? `Elegida: ${selected.name}` : "Colores personalizados"}</span>
        </div>
        <PalettePicker selectedId={selected?.id ?? null} onSelect={(p) => setDraft(applyPalette(theme, p.colors))} />
        {selected?.id !== V1_PALETTE.id && (
          <button className="btn btn--sm btn--soft" style={{ justifySelf: "start" }} onClick={() => setDraft(applyPalette(theme, V1_PALETTE.colors))}>
            Volver a los colores originales
          </button>
        )}
      </div>

      <div className="form-grid" style={{ alignItems: "start" }}>
        <div className="card stack">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Ajustar a mi gusto</h3>
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
    </AdminPage>
  );
}
