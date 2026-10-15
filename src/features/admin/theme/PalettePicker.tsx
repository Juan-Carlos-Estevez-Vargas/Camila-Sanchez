import { PALETTES, type Palette } from "@/domain/palettes";
import styles from "./PalettePicker.module.scss";

interface Props {
  /** id de la paleta elegida; null si los colores son personalizados. */
  selectedId: string | null;
  onSelect(palette: Palette): void;
}

/** Tarjetas con una miniatura de cada paleta pintada con sus colores reales. */
export function PalettePicker({ selectedId, onSelect }: Props) {
  return (
    <div className={styles.grid} role="group" aria-label="Paletas de colores">
      {PALETTES.map((palette) => {
        const c = palette.colors;
        const selected = palette.id === selectedId;
        return (
          <button key={palette.id} type="button" className={styles.option} aria-pressed={selected} onClick={() => onSelect(palette)}>
            <span className={styles.sample} style={{ background: c.background }} aria-hidden>
              <span className={styles.sampleTitle} style={{ color: c.text }}>Te amo</span>
              <span className={styles.sampleCard} style={{ background: c.surface }} />
              <span className={styles.sampleRow}>
                <span className={styles.sampleButton} style={{ background: c.primary }} />
                <span className={styles.sampleDot} style={{ background: c.accent }} />
                <span className={styles.sampleDot} style={{ background: c.muted }} />
              </span>
            </span>
            <span className={styles.name}>{palette.name}{selected && <span aria-label="elegida">✓</span>}</span>
            <span className={styles.description}>{palette.description}</span>
          </button>
        );
      })}
    </div>
  );
}
