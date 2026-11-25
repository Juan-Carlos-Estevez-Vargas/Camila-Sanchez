/**
 * Apariencia → Fechas especiales → 💐 Ramo de flores.
 *
 *   - `BouquetSettings`: encenderlo, para quién es y la firma de la nota (van
 *     con el resto de la Apariencia, en «Guardar»).
 *   - `BouquetNoteEditor`: el lugar, la hora y el mensaje de cada fecha. Se
 *     guardan aparte (tabla bouquet_notes) porque los ajustes del sitio son
 *     públicos y la invitación no debe verse antes de tiempo.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BOUQUETS, MAX_BOUQUET_MESSAGE, MAX_BOUQUET_PLACE, MAX_BOUQUET_SIGNATURE, MAX_BOUQUET_TIME,
  emptyNote, type BouquetConfig, type BouquetNote,
} from "@/domain/bouquets";
import type { SpecialDayId } from "@/domain/specialDays";
import type { Profile } from "@/domain/types";
import { toUserMessage } from "@/core/errors";
import { useT } from "@/i18n";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field, Switch } from "@/ui/Field";
import styles from "./SpecialDaysCard.module.scss";

export function BouquetSettings({ value, profiles, onChange }: { value: BouquetConfig; profiles: Profile[]; onChange(next: BouquetConfig): void }) {
  const t = useT().bouquet.admin;
  const set = (patch: Partial<BouquetConfig>) => onChange({ ...value, ...patch });
  return (
    <div className={styles.bouquet}>
      <h3 className={styles.bouquetTitle}>{t.title}</h3>
      <p className="muted" style={{ margin: 0 }}>{t.hint}</p>
      <Switch label={t.enabled} checked={value.enabled} onChange={(enabled) => set({ enabled })} />
      {value.enabled && (
        <div className="form-grid">
          <Field label={t.recipient}>
            {(id) => (
              <select id={id} className="select" value={value.recipientId ?? ""} onChange={(e) => set({ recipientId: e.target.value || null })}>
                <option value="">{t.recipientAuto}</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            )}
          </Field>
          <Field label={t.signature}>
            {(id) => (
              <input id={id} className="input" maxLength={MAX_BOUQUET_SIGNATURE} placeholder={t.signaturePlaceholder}
                value={value.signature} onChange={(e) => set({ signature: e.target.value })} />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}

export function BouquetNoteEditor({ dayId, saved, onSaved }: { dayId: SpecialDayId; saved: BouquetNote | null; onSaved(note: BouquetNote): void }) {
  const i18n = useT();
  const t = i18n.bouquet.admin;
  const flowers = i18n.bouquet.flowers[dayId];
  const backend = useBackend();
  const toast = useToast();
  const [note, setNote] = useState<BouquetNote>(() => saved ?? emptyNote(dayId));
  const [busy, setBusy] = useState(false);
  const base = saved ?? emptyNote(dayId);
  const dirty = note.place !== base.place || note.time !== base.time || note.message !== base.message;
  const set = (patch: Partial<BouquetNote>) => setNote((n) => ({ ...n, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const result = await backend.content.saveBouquetNote(note);
      onSaved(result);
      setNote(result);
      toast.success(t.saved);
    } catch (error) {
      toast.show({ title: toUserMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className={styles.music}>
      <summary>{t.summary(flowers.name)}{base.place ? <span className={styles.when}> · 📍 {base.place}</span> : null}</summary>
      <div className="form-grid">
        <Field label={t.place}>
          {(id) => <input id={id} className="input" maxLength={MAX_BOUQUET_PLACE} placeholder={t.placePlaceholder}
            value={note.place} onChange={(e) => set({ place: e.target.value })} />}
        </Field>
        <Field label={t.time}>
          {(id) => <input id={id} className="input" maxLength={MAX_BOUQUET_TIME} placeholder={t.timePlaceholder}
            value={note.time} onChange={(e) => set({ time: e.target.value })} />}
        </Field>
      </div>
      <Field label={t.message} hint={t.messageHint}>
        {(id) => <textarea id={id} className="textarea" rows={3} maxLength={MAX_BOUQUET_MESSAGE}
          placeholder={i18n.bouquet.invites[dayId]({ where: i18n.bouquet.where({ place: note.place.trim(), time: note.time.trim() }), name: "" })}
          value={note.message} onChange={(e) => set({ message: e.target.value })} />}
      </Field>
      <p className={styles.bouquetMeaning}><span aria-hidden>{BOUQUETS[dayId].icon}</span> <b>{t.meaning}:</b> {flowers.meaning}</p>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>🔒 {t.private}</p>
      <div className={styles.bouquetActions}>
        <button type="button" className="btn btn--sm" disabled={!dirty || busy} onClick={() => void save()}>{t.save}</button>
        <Link className="btn btn--sm btn--ghost" to={`/?tema=${dayId}&ramo=1`}>{t.preview} 💐</Link>
      </div>
    </details>
  );
}
