/**
 * La sorpresa del ramo a pantalla completa:
 *
 *   1. Un brillo y «Tengo algo para ti…» escrito a mano.
 *   2. Sube el ramo: los tallos se dibujan, brotan las hojas y cada flor se
 *      abre a su turno, entre pétalos que caen y destellos.
 *   3. Aparece la notita con la invitación (lugar y hora), el significado de
 *      las flores y la firma.
 *
 * Tocar durante la animación la salta hasta el final; con «Reducir
 * animaciones» se ve todo ya abierto. Es un diálogo: Esc lo cierra, el foco
 * queda adentro y vuelve a donde estaba al cerrar.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BOUQUETS, fillBouquetMessage, type BouquetNote } from "@/domain/bouquets";
import type { SpecialDayId } from "@/domain/specialDays";
import { useT } from "@/i18n";
import { useReducedMotion } from "@/ui/motion";
import { isTopDialog, useFocusTrap } from "@/ui/useFocusTrap";
import { BouquetArt, SingleFlower } from "./FlowerArt";
import styles from "./Bouquet.module.scss";

/** Cuánto dura la animación hasta que sale la nota (ms); coincide con el CSS. */
const REVEAL_MS = 4200;
const PETALS = 18;
const SPARKLES = 14;

interface Props {
  dayId: SpecialDayId;
  /** La noche anterior: la nota habla de «mañana». */
  eve: boolean;
  note: BouquetNote | null;
  /** Nombre de ella para la nota («Para Camila»). */
  name: string;
  signature: string;
  onClose(): void;
}

/** Números «al azar» pero fijos (la lluvia no salta en cada render). */
const seeded = (k: number, salt: number) => {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export default function BouquetReveal({ dayId, eve, note, name, signature, onClose }: Props) {
  const t = useT().bouquet;
  const style = BOUQUETS[dayId];
  const flowers = t.flowers[dayId];
  const reduced = useReducedMotion();
  const [done, setDone] = useState(reduced);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(dialog);

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(() => setDone(true), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopDialog(dialog.current)) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const place = note?.place.trim() ?? "";
  const time = note?.time.trim() ?? "";
  const custom = note?.message.trim() ?? "";
  const message = custom
    ? fillBouquetMessage(custom, { place, time, name })
    : t.invites[dayId]({ where: t.where({ place, time }), name, eve });
  const sign = signature.trim() ? t.signedBy(signature.trim()) : t.defaultSignature;

  return createPortal(
    <div ref={dialog} className={`${styles.overlay} ${done ? styles.done : ""}`} data-day={dayId}
      role="dialog" aria-modal="true" aria-labelledby={titleId}
      style={{ "--petal": style.petal, "--ribbon": style.ribbon } as CSSProperties}
      onClick={() => { if (!done) setDone(true); }}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.rain} aria-hidden>
        {Array.from({ length: PETALS }, (_, k) => (
          <span key={k} className={styles.petal}
            style={{
              "--x": `${Math.round(seeded(k, 1) * 100)}vw`,
              "--d": `${(seeded(k, 2) * 4).toFixed(2)}s`,
              "--s": `${(7 + seeded(k, 3) * 6).toFixed(2)}s`,
              "--r": `${Math.round(seeded(k, 4) * 360)}deg`,
              "--z": (0.6 + seeded(k, 5) * 0.8).toFixed(2),
            } as CSSProperties} />
        ))}
      </div>

      <button type="button" className={styles.close} aria-label={t.close} onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>

      <p className={styles.intro} aria-hidden>{t.intro}</p>

      <div className={styles.stage}>
        <div className={styles.bouquet}>
          <div className={styles.sparkles} aria-hidden>
            {Array.from({ length: SPARKLES }, (_, k) => (
              <span key={k} className={styles.sparkle}
                style={{
                  "--x": `${Math.round(8 + seeded(k, 6) * 84)}%`,
                  "--y": `${Math.round(4 + seeded(k, 7) * 60)}%`,
                  "--d": `${(2.4 + seeded(k, 8) * 2.4).toFixed(2)}s`,
                } as CSSProperties}>✦</span>
            ))}
          </div>
          <BouquetArt style={style} title={t.dialog(flowers.name)} />
        </div>

        <article className={styles.note} aria-live="polite">
          <h2 id={titleId} className={styles.noteTitle}>
            <SingleFlower style={style} size={34} /> {t.forName(name)}
          </h2>
          <p className={styles.message}>{message}</p>
          <dl className={styles.ticket}>
            <div><dt>📍 {t.placeLabel}</dt><dd>{place || t.soon}</dd></div>
            <div><dt>🕗 {t.timeLabel}</dt><dd>{eve ? (time ? t.tomorrowAt(time) : t.tomorrow) : (time || t.today)}</dd></div>
          </dl>
          <section className={styles.meaning}>
            <h3>{t.meaningTitle(flowers.name)}</h3>
            <p>{flowers.meaning}</p>
          </section>
          <p className={styles.signature}>{sign}</p>
          <button type="button" className={`btn ${styles.accept}`} onClick={(e) => { e.stopPropagation(); onClose(); }}>
            {t.accept}
          </button>
        </article>
      </div>

      {!done && <p className={styles.skip} aria-hidden>{t.skip}</p>}
    </div>,
    document.body,
  );
}
