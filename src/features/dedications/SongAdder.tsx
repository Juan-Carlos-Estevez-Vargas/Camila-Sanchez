/**
 * Agregar una canción: pegar un enlace (YouTube, Spotify u otro) o subir un
 * archivo de audio. Sirve tanto al escribir una dedicatoria nueva (las guarda
 * en borrador) como al editar una (las guarda enseguida).
 */
import { useRef, useState, type FormEvent } from "react";
import { audioExtension, MAX_AUDIO_BYTES, parseSongLink, songFromFileName } from "@/domain/songs";
import { useT } from "@/i18n";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";

export type SongDraft =
  | { kind: "link"; url: string; title: string; artist: string; note: string }
  | { kind: "audio"; file: File; extension: string; title: string; artist: string; note: string };

interface Props {
  onAdd(draft: SongDraft): Promise<void> | void;
  disabled?: boolean;
}

const EMPTY = { url: "", title: "", artist: "", note: "" };

export function SongAdder({ onAdd, disabled }: Props) {
  const t = useT().dedications.song;
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [audio, setAudio] = useState<{ file: File; extension: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const link = form.url.trim() ? parseSongLink(form.url) : null;
  const badLink = !!form.url.trim() && !link;
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const pickAudio = (file: File | undefined) => {
    if (!file) return;
    const extension = audioExtension(file);
    if (!extension) return toast.error(t.badAudio);
    if (file.size > MAX_AUDIO_BYTES) return toast.error(t.audioTooLarge);
    const guess = songFromFileName(file.name);
    setAudio({ file, extension });
    setForm((f) => ({ ...f, url: "", title: f.title || guess.title, artist: f.artist || guess.artist }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const title = form.title.trim();
    if (!title || (!audio && !link)) return;
    setBusy(true);
    try {
      await onAdd(audio
        ? { kind: "audio", file: audio.file, extension: audio.extension, title, artist: form.artist.trim(), note: form.note.trim() }
        : { kind: "link", url: link!.url, title, artist: form.artist.trim(), note: form.note.trim() });
      setForm(EMPTY);
      setAudio(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Un formulario aparte (no anidado): se envía con su propio botón.
    <form className="song-adder" onSubmit={(e) => void submit(e)}>
      {audio ? (
        <div className="song-adder__file">
          <span>🎵 {audio.file.name}</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAudio(null)}>✕</button>
        </div>
      ) : (
        <Field label={t.link} hint={t.linkHint} error={badLink ? t.badLink : undefined}>
          {(id) => (
            <div className="song-adder__link">
              <input id={id} className="input" type="url" inputMode="url" maxLength={500} placeholder={t.linkPlaceholder}
                value={form.url} onChange={(e) => set({ url: e.target.value })} />
              <span className="song-adder__detected" role="status">
                {link && <span className="badge badge--muted">{t.detected[link.source]}</span>}
              </span>
            </div>
          )}
        </Field>
      )}
      <div className="song-adder__row">
        <Field label={t.title}>
          {(id) => <input id={id} className="input" maxLength={200} required placeholder={t.titlePlaceholder} value={form.title} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
        <Field label={t.artist}>
          {(id) => <input id={id} className="input" maxLength={200} value={form.artist} onChange={(e) => set({ artist: e.target.value })} />}
        </Field>
      </div>
      <Field label={t.note}>
        {(id) => <input id={id} className="input" maxLength={500} placeholder={t.notePlaceholder} value={form.note} onChange={(e) => set({ note: e.target.value })} />}
      </Field>
      <div className="row song-adder__actions">
        <button className="btn btn--soft" disabled={disabled || busy || !form.title.trim() || (!audio && !link)}>{t.add}</button>
        {!audio && (
          <>
            <span className="muted">{t.orUpload}</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => fileInput.current?.click()}>{t.uploadAudio}</button>
          </>
        )}
        <input ref={fileInput} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.webm,.flac" hidden
          onChange={(e) => pickAudio(e.target.files?.[0])} />
      </div>
      {!audio && <p className="muted song-adder__hint">{t.audioHint}</p>}
    </form>
  );
}
