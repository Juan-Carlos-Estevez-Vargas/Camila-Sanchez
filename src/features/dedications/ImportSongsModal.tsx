/**
 * Importar varias canciones de una vez: enlaces pegados (uno por línea) o un
 * archivo .m3u/.m3u8. Se revisan antes de guardar (con su título editable) y
 * van a una dedicatoria mía o a una nueva.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MAX_DEDICATION_SONGS } from "@/domain/dedications";
import { toIsoDate } from "@/domain/dates";
import { parsePlaylistText, type ImportedSong } from "@/domain/songs";
import type { DedicationWithMedia, Profile } from "@/domain/types";
import { useT } from "@/i18n";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { RecipientSelect, SOURCE_ICONS } from "./parts";

interface Props {
  /** Las dedicatorias que escribí (para sumarles canciones). */
  mine: DedicationWithMedia[];
  people: Profile[];
  /** Si viene, se importan directo a esta. */
  into?: DedicationWithMedia;
  onClose(): void;
  onDone(): void;
}

const NEW = "__nueva__";

export function ImportSongsModal({ mine, people, into, onClose, onDone }: Props) {
  const backend = useBackend();
  const toast = useToast();
  const navigate = useNavigate();
  const t = useT().dedications;
  const [text, setText] = useState("");
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [target, setTarget] = useState<string>(into?.dedication.id ?? NEW);
  const [newTitle, setNewTitle] = useState(t.import.defaultTitle);
  const [recipientId, setRecipientId] = useState<string | null>(people[0]?.id ?? null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parsePlaylistText(text), [text]);
  const chosen = into ?? mine.find((d) => d.dedication.id === target);
  const room = chosen ? MAX_DEDICATION_SONGS - chosen.songs.length : MAX_DEDICATION_SONGS;
  const songs = parsed.songs.slice(0, Math.max(room, 0));
  const busy = progress !== null;

  const titleOf = (song: ImportedSong, i: number) => (titles[i] ?? song.title).trim() || t.song.untitled(i + 1);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    // Un .m3u de verdad pesa unos pocos KB.
    setText((await file.slice(0, 512 * 1024).text()).trim());
    setTitles({});
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async () => {
    if (!songs.length || busy) return;
    setProgress({ done: 0, total: songs.length });
    try {
      const dedicationId = chosen?.dedication.id ?? (await backend.dedications.create({
        recipientId, title: newTitle.trim() || t.import.defaultTitle, message: "", emoji: "🎶", dedicatedOn: toIsoDate(new Date()),
      })).id;
      let ok = 0;
      for (const [i, song] of songs.entries()) {
        try {
          await backend.dedications.addSong({ dedicationId, url: song.url, title: titleOf(song, i), artist: song.artist, note: "" });
          ok++;
        } catch {
          /* se cuenta abajo */
        }
        setProgress({ done: i + 1, total: songs.length });
      }
      const failed = songs.length - ok;
      if (failed) toast.error(t.import.partial(ok, failed));
      else toast.success(t.import.done(ok));
      onDone();
      onClose();
      if (!chosen) navigate(`/dedicatorias/${dedicationId}`);
    } catch (error) {
      toast.error(error);
      setProgress(null);
    }
  };

  const footer = (
    <button className="btn" type="button" disabled={busy || !songs.length || (!chosen && !newTitle.trim())} onClick={() => void submit()}>
      {progress ? t.import.importing(progress.done, progress.total) : t.import.submit(songs.length)}
    </button>
  );

  return (
    <Modal title={t.import.title} onClose={busy ? () => undefined : onClose} footer={footer} wide>
      <div className="stack import-songs">
        <p className="muted">{t.import.intro}</p>
        <Field label={t.import.paste}>
          {(id) => (
            <textarea id={id} className="textarea import-songs__text" rows={6} placeholder={t.import.pastePlaceholder} value={text} disabled={busy}
              onChange={(e) => { setText(e.target.value); setTitles({}); }} />
          )}
        </Field>
        <div className="row">
          <button type="button" className="btn btn--sm btn--soft" disabled={busy} onClick={() => fileInput.current?.click()}>{t.import.file}</button>
          <input ref={fileInput} type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,audio/mpegurl,application/vnd.apple.mpegurl,text/plain" hidden
            onChange={(e) => void openFile(e.target.files?.[0])} />
        </div>
        <details className="import-songs__help">
          <summary>{t.import.spotifyHow}</summary>
          <p>{t.import.spotifyHowBody}</p>
        </details>
        <details className="import-songs__help">
          <summary>{t.import.youtubeHow}</summary>
          <p>{t.import.youtubeHowBody}</p>
        </details>

        <div role="status" className="import-songs__status">
          {text.trim() && (parsed.songs.length ? <strong>{t.import.found(parsed.songs.length)}</strong> : <span className="muted">{t.import.nothing}</span>)}
          {parsed.skipped > 0 && <span className="muted"> {t.import.skipped(parsed.skipped)}</span>}
          {parsed.songs.length > songs.length && <span className="muted"> {t.song.tooMany(MAX_DEDICATION_SONGS)}</span>}
        </div>

        {songs.length > 0 && (
          <ol className="import-songs__list">
            {songs.map((song, i) => (
              <li key={song.url}>
                <span aria-hidden>{SOURCE_ICONS[song.source]}</span>
                <input className="input" aria-label={`${t.song.title} ${i + 1}`} maxLength={200} disabled={busy}
                  placeholder={t.song.untitled(i + 1)} value={titles[i] ?? song.title}
                  onChange={(e) => setTitles((all) => ({ ...all, [i]: e.target.value }))} />
                {song.artist && <span className="muted import-songs__artist">{song.artist}</span>}
              </li>
            ))}
          </ol>
        )}

        {!into && (
          <fieldset className="import-songs__target stack">
            <legend className="field__label">{t.import.whereTo}</legend>
            <select className="input" aria-label={t.import.whereTo} value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)}>
              <option value={NEW}>{t.import.newDedication}</option>
              {mine.map((d) => <option key={d.dedication.id} value={d.dedication.id}>{t.import.into(`${d.dedication.emoji} ${d.dedication.title}`)}</option>)}
            </select>
            {target === NEW && (
              <div className="song-adder__row">
                <Field label={t.import.newDedicationTitle}>
                  {(id) => <input id={id} className="input" maxLength={120} value={newTitle} disabled={busy} onChange={(e) => setNewTitle(e.target.value)} />}
                </Field>
                <Field label={t.import.recipient}>
                  {(id) => <RecipientSelect id={id} people={people} value={recipientId} onChange={setRecipientId} />}
                </Field>
              </div>
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
