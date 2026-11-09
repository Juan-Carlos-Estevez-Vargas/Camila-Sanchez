/**
 * Escribir una dedicatoria (con fotos y canciones de una vez) y cambiar el
 * texto de una ya enviada.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { DEDICATION_EMOJIS, MAX_DEDICATION_PHOTOS, MAX_DEDICATION_SONGS } from "@/domain/dedications";
import { toIsoDate } from "@/domain/dates";
import { parseSongLink } from "@/domain/songs";
import type { Dedication, DedicationPhoto, Profile } from "@/domain/types";
import type { Backend, DedicationInput } from "@/data/ports";
import { useT } from "@/i18n";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { burst } from "@/features/site/effects/FloatingEffects";
import { EmojiPicker, RecipientSelect, SongLabel } from "./parts";
import { SongAdder, type SongDraft } from "./SongAdder";
import { isLowResolution, SHARED_IMAGE_OPTIONS } from "@/services/images/sizing";

export const DEDICATION_IMAGE_OPTIONS = SHARED_IMAGE_OPTIONS;

export type DedicationFormValue = DedicationInput;

export const emptyDedication = (people: Profile[]): DedicationFormValue => ({
  // Si sólo hay otra persona, ya viene elegida.
  recipientId: people.length === 1 ? people[0]!.id : people[0]?.id ?? null,
  title: "",
  message: "",
  emoji: DEDICATION_EMOJIS[0],
  dedicatedOn: toIsoDate(new Date()),
});

/** Para quién, icono, título, mensaje y fecha. */
export function DedicationFields({ value, onChange, people }: { value: DedicationFormValue; onChange(v: DedicationFormValue): void; people: Profile[] }) {
  const t = useT().dedications.form;
  const set = (patch: Partial<DedicationFormValue>) => onChange({ ...value, ...patch });
  return (
    <>
      <Field label={t.recipient} hint={value.recipientId === null ? t.everyoneHint : undefined}>
        {(id) => <RecipientSelect id={id} people={people} value={value.recipientId} onChange={(recipientId) => set({ recipientId })} />}
      </Field>
      <div className="field">
        <span className="field__label" id="dedication-emoji-label">{t.icon}</span>
        <EmojiPicker labelId="dedication-emoji-label" value={value.emoji} onChange={(emoji) => set({ emoji })} />
      </div>
      <Field label={t.name} required>
        {(id) => <input id={id} className="input" maxLength={120} required placeholder={t.namePlaceholder} value={value.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <Field label={t.message}>
        {(id) => <textarea id={id} className="textarea" rows={6} maxLength={8000} placeholder={t.messagePlaceholder} value={value.message} onChange={(e) => set({ message: e.target.value })} />}
      </Field>
      <Field label={t.date}>
        {(id) => <input id={id} type="date" className="input" required value={value.dedicatedOn} onChange={(e) => set({ dedicatedOn: e.target.value })} />}
      </Field>
    </>
  );
}

/** Sube una canción en borrador a una dedicatoria ya creada. */
export async function saveSongDraft(backend: Backend, dedicationId: string, draft: SongDraft): Promise<void> {
  if (draft.kind === "audio") {
    await backend.dedications.addAudioSong({
      dedicationId, title: draft.title, artist: draft.artist, note: draft.note, file: draft.file, extension: draft.extension,
    });
  } else {
    await backend.dedications.addSong({ dedicationId, title: draft.title, artist: draft.artist, note: draft.note, url: draft.url });
  }
}

/** Optimiza y sube fotos; devuelve cuántas fallaron. */
export async function uploadPhotos(backend: Backend, processor: ImageProcessor, dedicationId: string, files: File[], onEach?: () => void): Promise<number> {
  let failed = 0;
  for (const file of files) {
    try {
      const image = await processor.process(file);
      await backend.dedications.addPhoto(dedicationId, {
        full: image.full, thumb: image.thumb, extension: image.extension, width: image.width, height: image.height,
      });
    } catch {
      failed++;
    }
    onEach?.();
  }
  return failed;
}

/** Cambia el archivo de una foto ya subida (mal cargada o de poca calidad); conserva su lugar. */
export async function replaceDedicationPhoto(backend: Backend, processor: ImageProcessor, photo: DedicationPhoto, file: File): Promise<DedicationPhoto> {
  const image = await processor.process(file);
  return backend.dedications.replacePhoto(photo, {
    full: image.full, thumb: image.thumb, extension: image.extension, width: image.width, height: image.height,
  });
}

/**
 * URL local (blob:) para ver una foto antes de subirla. Se copia a un Blob
 * nuevo con un tipo de imagen fijo, así el navegador sólo puede mostrarla como
 * imagen (nunca como HTML ni como script).
 */
function previewUrl(file: File): string {
  const type = /^image\/[a-z0-9.+-]+$/i.test(file.type) && file.type !== "image/svg+xml" ? file.type : "image/jpeg";
  return URL.createObjectURL(new Blob([file], { type }));
}

export function NewDedicationModal({ people, onClose }: { people: Profile[]; onClose(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const navigate = useNavigate();
  const i18n = useT();
  const t = i18n.dedications.form;
  const [form, setForm] = useState<DedicationFormValue>(() => emptyDedication(people));
  const [photos, setPhotos] = useState<File[]>([]);
  const [songs, setSongs] = useState<SongDraft[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const swapInput = useRef<HTMLInputElement>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  // Fotos chicas (se notan al cargar la vista previa): se avisa para cambiarlas.
  const [small, setSmall] = useState<Map<string, string>>(new Map());
  const processor = useMemo(() => new ImageProcessor(DEDICATION_IMAGE_OPTIONS), []);
  useEffect(() => () => processor.dispose(), [processor]);
  const previews = useMemo(() => photos.map(previewUrl), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const busy = progress !== null;

  const addPhotos = (files: FileList | null) => {
    const images = [...(files ?? [])].filter(isImageFile);
    const room = MAX_DEDICATION_PHOTOS - photos.length;
    if (images.length > room) toast.error(t.tooManyPhotos(MAX_DEDICATION_PHOTOS));
    setPhotos((p) => [...p, ...images.slice(0, Math.max(room, 0))]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const swapPhoto = (file: File | undefined) => {
    if (swapInput.current) swapInput.current.value = "";
    if (file && isImageFile(file) && swapping !== null) setPhotos((p) => p.map((f, i) => (i === swapping ? file : f)));
    setSwapping(null);
  };

  const checkSize = (url: string, img: HTMLImageElement) => {
    if (!isLowResolution(img.naturalWidth, img.naturalHeight)) return;
    setSmall((m) => new Map(m).set(url, t.lowResHint(img.naturalWidth, img.naturalHeight)));
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    const total = photos.length + songs.length;
    setProgress({ done: 0, total });
    let dedication: Dedication;
    try {
      dedication = await backend.dedications.create(form);
    } catch (error) {
      toast.error(error);
      setProgress(null);
      return;
    }
    let done = 0;
    const tick = () => setProgress({ done: ++done, total });
    let failed = await uploadPhotos(backend, processor, dedication.id, photos, tick);
    for (const draft of songs) {
      try {
        await saveSongDraft(backend, dedication.id, draft);
      } catch {
        failed++;
      }
      tick();
    }
    burst([form.emoji, "💖", "🎶"], 24);
    toast.success(t.created, failed ? t.someFailed(failed) : form.recipientId ? t.createdBody : t.createdEveryone);
    navigate(`/dedicatorias/${dedication.id}`);
  };

  const footer = (
    <button className="btn" type="submit" form="new-dedication" disabled={busy || !form.title.trim()}>
      {progress ? (progress.total ? t.uploading(progress.done, progress.total) : t.sending) : t.send}
    </button>
  );

  return (
    <Modal title={t.newTitle} onClose={busy ? () => undefined : onClose} footer={footer} wide>
      <div className="stack dedication-form">
        <form id="new-dedication" className="stack" onSubmit={(e) => void send(e)}>
          <DedicationFields value={form} onChange={setForm} people={people} />
        </form>

        <section className="stack" aria-labelledby="new-dedication-photos">
          <h3 id="new-dedication-photos" className="dedication-form__heading">
            {t.photos} {photos.length > 0 && <span className="muted">{photos.length}/{MAX_DEDICATION_PHOTOS}</span>}
          </h3>
          <div className="ded-thumbs">
            {previews.map((url, i) => (
              <div key={url} className="ded-thumbs__item">
                <img src={url} alt="" onLoad={(e) => checkSize(url, e.currentTarget)} />
                {small.has(url) && <span className="ded-thumbs__lowres" title={small.get(url)} role="img" aria-label={`${t.lowRes}. ${small.get(url)}`}>⚠️</span>}
                <button type="button" className="ded-thumbs__swap" aria-label={t.replacePhoto} title={t.replacePhoto} disabled={busy}
                  onClick={() => { setSwapping(i); swapInput.current?.click(); }}>🔄</button>
                <button type="button" className="ded-thumbs__remove" aria-label={t.removePhoto} disabled={busy}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {photos.length < MAX_DEDICATION_PHOTOS && (
              <button type="button" className="ded-thumbs__add" disabled={busy} onClick={() => fileInput.current?.click()}>{t.addPhotos}</button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          <input ref={swapInput} type="file" accept="image/*" hidden onChange={(e) => swapPhoto(e.target.files?.[0])} />
        </section>

        <section className="stack" aria-labelledby="new-dedication-songs">
          <h3 id="new-dedication-songs" className="dedication-form__heading">
            {t.songs} {songs.length > 0 && <span className="muted">{songs.length}/{MAX_DEDICATION_SONGS}</span>}
          </h3>
          {songs.length === 0 ? <p className="muted">{t.noSongs}</p> : (
            <ol className="song-list">
              {songs.map((draft, i) => (
                <li key={i} className="song-list__item">
                  <span className="song-list__main">
                    <SongLabel song={{ ...draft, source: draft.kind === "audio" ? "audio" : parseSongLink(draft.url)?.source ?? "link" }} />
                  </span>
                  <button type="button" className="btn btn--icon btn--ghost" aria-label={i18n.dedications.song.remove} disabled={busy}
                    onClick={() => setSongs((s) => s.filter((_, j) => j !== i))}>✕</button>
                </li>
              ))}
            </ol>
          )}
          {songs.length < MAX_DEDICATION_SONGS && <SongAdder disabled={busy} onAdd={(draft) => setSongs((s) => [...s, draft])} />}
        </section>
      </div>
    </Modal>
  );
}

/** Cambiar para quién es, el icono, el título, el mensaje o la fecha. */
export function EditDedicationModal({ dedication, people, onClose, onSaved }: { dedication: Dedication; people: Profile[]; onClose(): void; onSaved(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const t = useT().dedications;
  const [form, setForm] = useState<DedicationFormValue>({
    recipientId: dedication.recipientId, title: dedication.title, message: dedication.message,
    emoji: dedication.emoji, dedicatedOn: dedication.dedicatedOn,
  });
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await backend.dedications.update(dedication.id, form);
      toast.success(t.page.saved);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal title={t.form.editTitle} onClose={onClose}>
      <form className="stack" onSubmit={(e) => void save(e)}>
        <DedicationFields value={form} onChange={setForm} people={people} />
        <button className="btn" disabled={busy || !form.title.trim()}>{busy ? t.form.saving : t.form.save}</button>
      </form>
    </Modal>
  );
}
