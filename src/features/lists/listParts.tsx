/** Piezas compartidas por el listado y la página de cada lista. */
import { useEffect, useState } from "react";
import { dueLabel, dueState, LIST_EMOJIS } from "@/domain/lists";
import type { IsoDate } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { Field } from "@/ui/Field";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { Modal } from "@/ui/Modal";

export interface ListFormValue {
  title: string;
  description: string;
  emoji: string;
  dueOn: string;
}

export const EMPTY_LIST_FORM: ListFormValue = { title: "", description: "", emoji: LIST_EMOJIS[0], dueOn: "" };

/** Nombre, icono, descripción y fecha de una lista. */
export function ListFields({ value, onChange }: { value: ListFormValue; onChange(next: ListFormValue): void }) {
  const set = (patch: Partial<ListFormValue>) => onChange({ ...value, ...patch });
  return (
    <>
      <Field label="Nombre">
        {(id) => <input id={id} className="input" maxLength={120} required placeholder="Ej.: Viaje a la playa" value={value.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <div className="field">
        <span className="field__label" id="list-emoji-label">Icono</span>
        <div className="emoji-picker" role="radiogroup" aria-labelledby="list-emoji-label" onKeyDown={onRovingKeyDown}>
          {LIST_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" role="radio" aria-checked={value.emoji === emoji} tabIndex={rovingTabIndex(value.emoji === emoji || (!(LIST_EMOJIS as readonly string[]).includes(value.emoji) && emoji === LIST_EMOJIS[0]))} aria-label={emoji}
              className={`emoji-picker__option${value.emoji === emoji ? " is-active" : ""}`} onClick={() => set({ emoji })}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <Field label="Descripción (opcional)">
        {(id) => <textarea id={id} className="textarea" rows={3} maxLength={2000} placeholder="¿De qué se trata?" value={value.description} onChange={(e) => set({ description: e.target.value })} />}
      </Field>
      <Field label="Fecha límite (opcional)">
        {(id) => <input id={id} type="date" className="input" value={value.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />}
      </Field>
    </>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} de ${total} hechas`}>
      <span className="progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** «Vence hoy», «Venció ayer»… con el color según qué tan cerca está. */
export function DueBadge({ dueOn, done = false }: { dueOn: IsoDate; done?: boolean }) {
  const state = done ? "later" : dueState(dueOn);
  const tone = state === "overdue" ? " badge--danger" : state === "today" || state === "soon" ? " badge--warning" : " badge--muted";
  return <span className={`badge${tone}`}>📅 {dueLabel(dueOn)}</span>;
}

/** Resuelve (y recuerda) las URLs de las fotos de una lista. */
export function useListImages(paths: readonly string[]): Map<string, string> {
  const backend = useBackend();
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const key = [...new Set(paths)].sort().join("|");

  useEffect(() => {
    const missing = key ? key.split("|").filter((p) => !urls.has(p)) : [];
    if (missing.length === 0) return;
    let active = true;
    backend.lists.resolveImages(missing)
      .then((found) => active && setUrls((current) => new Map([...current, ...found])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key, urls, backend]);

  return urls;
}

/** Foto en grande. */
export function ImageViewer({ path, onClose }: { path: string; onClose(): void }) {
  const urls = useListImages([path]);
  const url = urls.get(path);
  return (
    <Modal title="Foto" wide onClose={onClose}>
      <div className="list-photo-viewer">
        {url ? <img src={url} alt="Foto de la tarea" /> : <p className="muted">Cargando…</p>}
      </div>
    </Modal>
  );
}
