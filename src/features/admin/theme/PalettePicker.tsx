import { paletteDescription, paletteName, PALETTES, type Palette } from "@/domain/palettes";
import styles from "./PalettePicker.module.scss";
import { useT } from "@/i18n";

interface Props {
  /** id de la paleta elegida; null si los colores son personalizados. */
  selectedId: string | null;
  onSelect(palette: Palette): void;
}

/** Tarjetas con una miniatura de cada paleta pintada con sus colores reales. */
export function PalettePicker({ selectedId, onSelect }: Props) {
  const t = useT().admin.themeUi;
  return (
    <div className={styles.grid} role="group" aria-label={t.palettes}>
      {PALETTES.map((palette) => {
        const c = palette.colors;
        const selected = palette.id === selectedId;
        return (
          <button key={palette.id} type="button" className={styles.option} aria-pressed={selected} onClick={() => onSelect(palette)}>
            <span className={styles.sample} style={{ background: c.background }} aria-hidden>
              <span className={styles.sampleTitle} style={{ color: c.text }}>{t.sample}</span>
              <span className={styles.sampleCard} style={{ background: c.surface }} />
              <span className={styles.sampleRow}>
                <span className={styles.sampleButton} style={{ background: c.primary }} />
                <span className={styles.sampleDot} style={{ background: c.accent }} />
                <span className={styles.sampleDot} style={{ background: c.muted }} />
              </span>
            </span>
            <span className={styles.name}>{paletteName(palette)}{selected && <span aria-label={t.chosen}>✓</span>}</span>
            <span className={styles.description}>{paletteDescription(palette)}</span>
          </button>
        );
      })}
    </div>
  );
}
