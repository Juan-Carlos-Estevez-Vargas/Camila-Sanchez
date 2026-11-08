/** Piezas compartidas por el listado, la página de cada dedicatoria y la playlist. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { canUseDedications } from "@/domain/dedications";
import type { Dedication, DedicationSong, Profile, RolePermission, SongSource } from "@/domain/types";
import { useT } from "@/i18n";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Modal } from "@/ui/Modal";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { DEDICATION_EMOJIS } from "@/domain/dedications";

export const SOURCE_ICONS: Record<SongSource, string> = { youtube: "▶️", spotify: "🟢", audio: "🎵", link: "🔗" };

/** Resuelve (y recuerda) las URLs de fotos y audios de las dedicatorias. */
export function useDedicationMedia(paths: readonly string[]): Map<string, string> {
  const backend = useBackend();
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const key = [...new Set(paths)].sort().join("|");

  useEffect(() => {
    const missing = key ? key.split("|").filter((p) => !urls.has(p)) : [];
    if (missing.length === 0) return;
    let active = true;
    backend.dedications.resolveMedia(missing)
      .then((found) => active && setUrls((current) => new Map([...current, ...found])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key, urls, backend]);

  return urls;
}

/** «tú», el nombre de la persona o «alguien». */
export function usePeopleNames(profiles: readonly Profile[]) {
  const { user } = useAuth();
  const t = useT().dedications;
  const nameOf = useCallback(
    (id: string | null) => (id === user?.id ? t.you : profiles.find((p) => p.id === id)?.displayName || t.someone),
    [profiles, user?.id, t],
  );
  /** «De Juan para ti», «De ti para Todos»… */
  const fromTo = useCallback(
    (d: Pick<Dedication, "authorId" | "recipientId">) => t.fromTo(nameOf(d.authorId), d.recipientId ? nameOf(d.recipientId) : t.forEveryone.toLowerCase()),
    [nameOf, t],
  );
  return { nameOf, fromTo };
}

/** Personas a las que se les puede dedicar algo (activas, con permiso y que no sean yo). */
export function useRecipients(profiles: readonly Profile[], rolePermissions: readonly RolePermission[]): Profile[] {
  const { user } = useAuth();
  return useMemo(
    () => profiles.filter((p) => p.id !== user?.id && canUseDedications(p, rolePermissions)),
    [profiles, rolePermissions, user?.id],
  );
}

/** ¿Para quién? — las personas o «Para todos». */
export function RecipientSelect({ id, people, value, onChange }: { id: string; people: Profile[]; value: string | null; onChange(v: string | null): void }) {
  const t = useT().dedications;
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {people.map((p) => <option key={p.id} value={p.id}>{p.displayName || t.someone}</option>)}
      <option value="">{t.forEveryone} 💞</option>
    </select>
  );
}

export function EmojiPicker({ value, onChange, labelId }: { value: string; onChange(emoji: string): void; labelId: string }) {
  const selected = (DEDICATION_EMOJIS as readonly string[]).includes(value) ? value : DEDICATION_EMOJIS[0];
  return (
    <div className="ded-emoji" role="radiogroup" aria-labelledby={labelId} onKeyDown={onRovingKeyDown}>
      {DEDICATION_EMOJIS.map((emoji) => (
        <button key={emoji} type="button" role="radio" aria-checked={selected === emoji} tabIndex={rovingTabIndex(selected === emoji)} aria-label={emoji}
          className={`ded-emoji__option${selected === emoji ? " is-active" : ""}`} onClick={() => onChange(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Icono, nombre y artista de una canción. */
export function SongLabel({ song }: { song: Pick<DedicationSong, "title" | "artist" | "source" | "note"> }) {
  const t = useT().dedications.song;
  return (
    <span className="song-label">
      <span className="song-label__icon" title={t.sources[song.source]} aria-hidden>{SOURCE_ICONS[song.source]}</span>
      <span className="song-label__text">
        <strong>{song.title}</strong>
        {song.artist && <span className="muted"> · {song.artist}</span>}
        <span className="visually-hidden"> ({t.sources[song.source]})</span>
        {song.note && <span className="song-label__note muted">{song.note}</span>}
      </span>
    </span>
  );
}

/** Foto en grande. */
export function PhotoViewer({ path, onClose }: { path: string; onClose(): void }) {
  const urls = useDedicationMedia([path]);
  const url = urls.get(path);
  const t = useT();
  return (
    <Modal title={t.dedications.page.photo} wide onClose={onClose}>
      <div className="dedication-photo-viewer">
        {url ? <img src={url} alt="" /> : <p className="muted">{t.common.loadingEllipsis}</p>}
      </div>
    </Modal>
  );
}

/** Descarga un texto como archivo. */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
