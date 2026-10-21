/**
 * Detalle de una tarea: todo se guarda solo (el texto al salir del campo, lo
 * demás al cambiarlo) y los demás lo ven en vivo.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formatRelative } from "@/domain/dates";
import { MAX_TASK_IMAGES } from "@/domain/lists";
import type { Profile, TodoImage, TodoItem, TodoListDetail } from "@/domain/types";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";
import { ImageViewer, useListImages } from "./listParts";

const TASK_IMAGE_OPTIONS = { maxEdge: 1600, thumbEdge: 480, quality: 0.82, targetBytes: 350 * 1024, minQuality: 0.66 };

interface Props {
  item: TodoItem;
  detail: TodoListDetail;
  members: Profile[];
  nameOf(id: string | null): string;
  onChanged(): Promise<void>;
  onToggle(item: TodoItem): void;
  onClose(): void;
}

/** Texto que se guarda al salir del campo; si otra persona lo cambia, se actualiza. */
function useDraft(value: string): [string, (v: string) => void, { onFocus(): void; onBlur(): void }] {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return [draft, setDraft, { onFocus: () => (focused.current = true), onBlur: () => (focused.current = false) }];
}

export function TaskEditor({ item, detail, members, nameOf, onChanged, onToggle, onClose }: Props) {
  const backend = useBackend();
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [title, setTitle, titleFocus] = useDraft(item.title);
  const [description, setDescription, descriptionFocus] = useDraft(item.description);
  const [subtask, setSubtask] = useState("");
  const [material, setMaterial] = useState({ name: "", quantity: "" });
  const [uploading, setUploading] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const processor = useMemo(() => new ImageProcessor(TASK_IMAGE_OPTIONS), []);
  useEffect(() => () => processor.dispose(), [processor]);

  const isSubtask = !!item.parentId;
  const subtasks = detail.items.filter((i) => i.parentId === item.id).sort((a, b) => a.position - b.position);
  const materials = detail.materials.filter((m) => m.itemId === item.id);
  const images = detail.images.filter((i) => i.itemId === item.id);
  const urls = useListImages(images.map((i) => i.thumbPath));

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await onChanged();
    } catch (error) {
      toast.error(error);
      await onChanged();
    }
  };

  const saveTitle = () => {
    const text = title.trim();
    if (!text) return setTitle(item.title);
    if (text !== item.title) void run(() => backend.lists.saveItem({ id: item.id, listId: item.listId, title: text }));
  };
  const saveDescription = () => {
    if (description !== item.description) void run(() => backend.lists.saveItem({ id: item.id, listId: item.listId, description }));
  };

  const addSubtask = (e: FormEvent) => {
    e.preventDefault();
    const text = subtask.trim();
    if (!text) return;
    setSubtask("");
    void run(() => backend.lists.saveItem({ listId: item.listId, parentId: item.id, title: text }));
  };

  const addMaterial = (e: FormEvent) => {
    e.preventDefault();
    if (!material.name.trim()) return;
    const next = material;
    setMaterial({ name: "", quantity: "" });
    void run(() => backend.lists.saveMaterial({ itemId: item.id, name: next.name, quantity: next.quantity }));
  };

  const addPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter(isImageFile);
    e.target.value = "";
    if (files.length === 0) return;
    const room = MAX_TASK_IMAGES - images.length;
    if (files.length > room) toast.show({ title: `Máximo ${MAX_TASK_IMAGES} fotos por tarea` });
    const batch = files.slice(0, Math.max(room, 0));
    setUploading((n) => n + batch.length);
    for (const file of batch) {
      try {
        const optimized = await processor.process(file);
        await backend.lists.addImage(item.listId, item.id, {
          full: optimized.full, thumb: optimized.thumb, extension: optimized.extension, width: optimized.width, height: optimized.height,
        });
      } catch (error) {
        toast.error(error, "No se subió la foto");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    await onChanged();
  };

  const removeImage = async (image: TodoImage) => {
    if (!(await confirm({ title: "¿Quitar esta foto?", confirmLabel: "Quitar", danger: true }))) return;
    void run(() => backend.lists.deleteImage(image));
  };

  const removeTask = async () => {
    const extra = subtasks.length ? ` y sus ${subtasks.length} subtareas` : "";
    if (!(await confirm({ title: `¿Borrar «${item.title}»?`, body: `Se borra para todos${extra}, con sus materiales y fotos.`, confirmLabel: "Borrar", danger: true }))) return;
    try {
      await backend.lists.deleteItem(item.id);
      onClose();
      await onChanged();
    } catch (error) {
      toast.error(error);
    }
  };

  const parent = isSubtask ? detail.items.find((i) => i.id === item.parentId) : null;

  return (
    <Modal
      title={<label className="task-editor__done"><input type="checkbox" className="check" checked={!!item.doneAt} onChange={() => onToggle(item)} aria-label="Hecha" /> {isSubtask ? "Subtarea" : "Tarea"}</label>}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost btn--sm task-editor__delete" onClick={() => void removeTask()}>🗑 Borrar</button>
          <button className="btn" onClick={onClose}>Listo</button>
        </>
      }
    >
      <div className="task-editor stack">
        {parent && <p className="muted task-editor__parent">De la tarea «{parent.title}»</p>}
        <input className="input task-editor__title" aria-label="Título de la tarea" maxLength={300} value={title}
          onChange={(e) => setTitle(e.target.value)} {...titleFocus}
          onBlur={() => { titleFocus.onBlur(); saveTitle(); }}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
        <p className="muted task-editor__meta">
          {item.createdBy && <>Agregada por {nameOf(item.createdBy)} {formatRelative(item.createdAt)}</>}
          {item.doneAt && <> · Hecha por {nameOf(item.doneBy)} {formatRelative(item.doneAt)}</>}
        </p>

        <div className="form-grid">
          <Field label="Fecha límite">
            {(id) => <input id={id} type="date" className="input" value={item.dueOn ?? ""}
              onChange={(e) => void run(() => backend.lists.saveItem({ id: item.id, listId: item.listId, dueOn: e.target.value || null }))} />}
          </Field>
          <Field label="¿Quién se encarga?">
            {(id) => (
              <select id={id} className="select" value={item.assigneeId ?? ""}
                onChange={(e) => void run(() => backend.lists.saveItem({ id: item.id, listId: item.listId, assigneeId: e.target.value || null }))}>
                <option value="">Nadie en particular</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.displayName || "Sin nombre"}</option>)}
              </select>
            )}
          </Field>
        </div>

        <Field label="Descripción" hint="Se guarda sola al salir del cuadro.">
          {(id) => <textarea id={id} className="textarea" rows={3} maxLength={4000} placeholder="Detalles, ideas, enlaces…" value={description}
            onChange={(e) => setDescription(e.target.value)} {...descriptionFocus}
            onBlur={() => { descriptionFocus.onBlur(); saveDescription(); }} />}
        </Field>

        {!isSubtask && (
          <section className="task-editor__section" aria-labelledby="subtasks-title">
            <h4 id="subtasks-title">☑️ Subtareas {subtasks.length > 0 && <span className="muted">{subtasks.filter((s) => s.doneAt).length}/{subtasks.length}</span>}</h4>
            {subtasks.length > 0 && (
              <ul className="mini-list">
                {subtasks.map((s) => (
                  <li key={s.id} className={s.doneAt ? "is-done" : ""}>
                    <input type="checkbox" className="check check--sm" checked={!!s.doneAt} onChange={() => onToggle(s)} aria-label={`Subtarea «${s.title}»`} />
                    <span className="grow">{s.title}</span>
                    <button className="btn btn--icon btn--ghost btn--sm" aria-label={`Borrar «${s.title}»`} onClick={() => void run(() => backend.lists.deleteItem(s.id))}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <form className="mini-form" onSubmit={addSubtask}>
              <input className="input grow" maxLength={300} placeholder="Agregar subtarea…" aria-label="Nueva subtarea" value={subtask} onChange={(e) => setSubtask(e.target.value)} />
              <button className="btn btn--soft btn--sm" disabled={!subtask.trim()}>Agregar</button>
            </form>
          </section>
        )}

        <section className="task-editor__section" aria-labelledby="materials-title">
          <h4 id="materials-title">🧰 Materiales {materials.length > 0 && <span className="muted">{materials.filter((m) => m.isReady).length}/{materials.length} listos</span>}</h4>
          {materials.length > 0 && (
            <ul className="mini-list">
              {materials.map((m) => (
                <li key={m.id} className={m.isReady ? "is-done" : ""}>
                  <input type="checkbox" className="check check--sm" checked={m.isReady} aria-label={`Ya tenemos «${m.name}»`}
                    onChange={() => void run(() => backend.lists.saveMaterial({ id: m.id, itemId: item.id, isReady: !m.isReady }))} />
                  <span className="grow">{m.name}</span>
                  {m.quantity && <span className="badge badge--muted">{m.quantity}</span>}
                  <button className="btn btn--icon btn--ghost btn--sm" aria-label={`Quitar «${m.name}»`} onClick={() => void run(() => backend.lists.deleteMaterial(m.id))}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <form className="mini-form" onSubmit={addMaterial}>
            <input className="input grow" maxLength={120} placeholder="Material…" aria-label="Nuevo material" value={material.name} onChange={(e) => setMaterial({ ...material, name: e.target.value })} />
            <input className="input mini-form__qty" maxLength={40} placeholder="Cantidad" aria-label="Cantidad" value={material.quantity} onChange={(e) => setMaterial({ ...material, quantity: e.target.value })} />
            <button className="btn btn--soft btn--sm" disabled={!material.name.trim()}>Agregar</button>
          </form>
        </section>

        <section className="task-editor__section" aria-labelledby="photos-title">
          <h4 id="photos-title">📷 Fotos {images.length > 0 && <span className="muted">{images.length}/{MAX_TASK_IMAGES}</span>}</h4>
          <div className="thumb-grid">
            {images.map((image) => (
              <div key={image.id} className="thumb-grid__item">
                <button className="thumb-grid__open" onClick={() => setViewing(image.path)} aria-label="Ver foto en grande">
                  {urls.get(image.thumbPath) ? <img src={urls.get(image.thumbPath)} alt="" loading="lazy" /> : <span aria-hidden>📷</span>}
                </button>
                <button className="thumb-grid__remove" aria-label="Quitar foto" onClick={() => void removeImage(image)}>✕</button>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => <div key={`up-${i}`} className="thumb-grid__item is-loading" aria-label="Subiendo foto" />)}
            {images.length + uploading < MAX_TASK_IMAGES && (
              <button className="thumb-grid__add" onClick={() => fileInput.current?.click()}>
                <span aria-hidden>＋</span> Agregar fotos
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addPhotos(e)} />
        </section>
      </div>
      {viewing && <ImageViewer path={viewing} onClose={() => setViewing(null)} />}
      {confirmElement}
    </Modal>
  );
}
