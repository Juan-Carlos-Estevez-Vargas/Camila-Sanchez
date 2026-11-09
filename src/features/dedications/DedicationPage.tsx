/**
 * /dedicatorias/:id — la dedicatoria como una carta: mensaje, fotos y sus
 * canciones para escucharlas. Quien la escribió la edita aquí mismo.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MAX_DEDICATION_PHOTOS, MAX_DEDICATION_SONGS } from "@/domain/dedications";
import { formatLongDate } from "@/domain/dates";
import { buildPlaylist } from "@/domain/songs";
import type { DedicationPhoto, DedicationSong } from "@/domain/types";
import { useT } from "@/i18n";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { isLowResolution } from "@/services/images/sizing";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { toPlayerTracks, usePlayer } from "@/features/player/PlayerContext";
import { DEDICATION_IMAGE_OPTIONS, EditDedicationModal, replaceDedicationPhoto, saveSongDraft, uploadPhotos } from "./DedicationForm";
import { DEDICATION_TABLES } from "./DedicationsPage";
import { ImportSongsModal } from "./ImportSongsModal";
import { PhotoViewer, SeenBy, SongLabel, useDedicationMedia, usePeopleNames, useRecipients } from "./parts";
import { SongAdder } from "./SongAdder";
import "./styles/dedications.scss";

export default function DedicationPage() {
  const { id = "" } = useParams();
  const backend = useBackend();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const player = usePlayer();
  const { items: notifications, markRead } = useNotifications();
  const [confirm, confirmElement] = useConfirm();
  const i18n = useT();
  const t = i18n.dedications;
  const [editing, setEditing] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const swapInput = useRef<HTMLInputElement>(null);
  const [swapping, setSwapping] = useState<DedicationPhoto | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const processor = useMemo(() => new ImageProcessor(DEDICATION_IMAGE_OPTIONS), []);
  useEffect(() => () => processor.dispose(), [processor]);

  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.dedications.get(id), backend.users.listProfiles(), backend.users.listRolePermissions()]),
    [backend, id],
  );
  const [item = null, profiles = [], rolePermissions = []] = data ?? [];
  const people = useRecipients(profiles, rolePermissions);
  const { fromTo } = usePeopleNames(profiles);
  // Una sola foto se ve grande: se usa la original en vez de la miniatura.
  const shownPath = (p: { path: string; thumbPath: string }) => (item?.photos.length === 1 ? p.path : p.thumbPath);
  const thumbs = useDedicationMedia(item?.photos.map(shownPath) ?? []);
  const queue = useMemo(() => (item ? toPlayerTracks(buildPlaylist([item])) : []), [item]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = backend.realtime.subscribe([...DEDICATION_TABLES], () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [backend, reload]);

  // Abrirla cuenta como «la vio» (para quien la escribió); una vez por visita.
  const markedSeen = useRef<string | null>(null);
  const loadedId = item?.dedication.id;
  useEffect(() => {
    if (!loadedId || markedSeen.current === loadedId) return;
    markedSeen.current = loadedId;
    void backend.dedications.markSeen(loadedId).catch(() => undefined);
  }, [backend, loadedId]);

  // Estando en la dedicatoria, su aviso se da por visto.
  useEffect(() => {
    for (const n of notifications) {
      if (!n.readAt && n.kind === "dedication" && n.link === `/dedicatorias/${id}`) void markRead(n.id);
    }
  }, [notifications, id, markRead]);

  if (loading && !data) return <main id="contenido-principal" className="container dedications"><PageLoader /></main>;
  if (!item) {
    return (
      <main id="contenido-principal" className="container dedications">
        <EmptyState icon="🔒" title={t.page.missing}>
          <Link to="/dedicatorias" className="btn btn--soft">{t.page.all}</Link>
        </EmptyState>
      </main>
    );
  }

  const { dedication, photos, songs } = item;
  const mine = dedication.authorId === user?.id;
  const run = async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (error) {
      toast.error(error);
    }
    await reload();
  };

  const remove = async () => {
    const ok = await confirm({ title: t.page.confirmDelete, body: t.page.confirmDeleteBody, confirmLabel: t.page.delete, danger: true });
    if (!ok) return;
    try {
      if (player.current?.dedicationId === dedication.id) player.close();
      await backend.dedications.remove(dedication.id);
      toast.success(t.page.deleted);
      navigate("/dedicatorias");
    } catch (error) {
      toast.error(error);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    const images = [...(files ?? [])].filter(isImageFile);
    if (fileInput.current) fileInput.current.value = "";
    const room = MAX_DEDICATION_PHOTOS - photos.length;
    if (images.length > room) toast.error(t.form.tooManyPhotos(MAX_DEDICATION_PHOTOS));
    const chosen = images.slice(0, Math.max(room, 0));
    if (!chosen.length) return;
    setUploading(chosen.length);
    const failed = await uploadPhotos(backend, processor, dedication.id, chosen, () => setUploading((n) => n - 1));
    setUploading(0);
    if (failed) toast.error(t.form.someFailed(failed));
    await reload();
  };

  // Cambia el archivo de una foto (mal cargada o borrosa) sin moverla de lugar.
  const replacePhoto = async (file: File | undefined) => {
    const photo = swapping;
    if (swapInput.current) swapInput.current.value = "";
    setSwapping(null);
    if (!photo || !file || !isImageFile(file)) return;
    setReplacingId(photo.id);
    await run(async () => {
      await replaceDedicationPhoto(backend, processor, photo, file);
      toast.success(t.form.photoReplaced);
    });
    setReplacingId(null);
  };

  const move = (song: DedicationSong, delta: number) => {
    const ids = songs.map((s) => s.id);
    const from = ids.indexOf(song.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    void run(() => backend.dedications.reorderSongs(dedication.id, ids));
  };

  return (
    <main id="contenido-principal" className="container dedications dedication-page">
      <Link to="/dedicatorias" className="dedication-page__back">{t.page.back}</Link>

      <article className="dedication-letter card">
        <header className="dedication-letter__header">
          <span className="dedication-letter__emoji" aria-hidden>{dedication.emoji}</span>
          <h1>{dedication.title}</h1>
          <p className="muted">{fromTo(dedication)} · {formatLongDate(dedication.dedicatedOn)}</p>
        </header>
        {dedication.message && <div className="dedication-letter__message">{dedication.message}</div>}

        {mine && (
          <div className="row dedication-letter__owner">
            {editing ? (
              <>
                <button className="btn btn--sm btn--soft" onClick={() => setEditingText(true)}>{t.form.editTitle}</button>
                <button className="btn btn--sm" onClick={() => setEditing(false)}>{t.page.done}</button>
              </>
            ) : (
              <button className="btn btn--sm btn--soft" onClick={() => setEditing(true)}>{t.page.edit}</button>
            )}
            <button className="btn btn--sm btn--ghost btn--danger-text" onClick={() => void remove()}>{t.page.delete}</button>
          </div>
        )}
        {editing && <p className="muted dedication-letter__hint">{t.page.editing}</p>}
        {mine && <SeenBy dedication={dedication} views={item.views} audience={people} profiles={profiles} />}
      </article>

      {(photos.length > 0 || editing) && (
        <section className="stack" aria-labelledby="dedication-photos">
          <h2 id="dedication-photos" className="dedication-page__heading">
            📷 {t.form.photos} {editing && <span className="dedication-page__count">{photos.length}/{MAX_DEDICATION_PHOTOS}</span>}
          </h2>
          <div className={`ded-photos${photos.length === 1 ? " is-single" : ""}`}>
            {photos.map((photo, i) => (
              <div key={photo.id} className={`ded-photos__item${replacingId === photo.id ? " is-replacing" : ""}`} aria-busy={replacingId === photo.id}>
                <button type="button" className="ded-photos__open" onClick={() => setViewing(photo.path)} aria-label={t.page.photoAlt(i + 1)}>
                  {thumbs.get(shownPath(photo)) ? <img src={thumbs.get(shownPath(photo))} alt="" loading="lazy" /> : <span aria-hidden>📷</span>}
                </button>
                {editing && photo.width && photo.height && isLowResolution(photo.width, photo.height) && (
                  <span className="ded-photos__lowres" title={t.form.lowResHint(photo.width, photo.height)}>⚠️ {t.form.lowRes}</span>
                )}
                {editing && (
                  <>
                    <button type="button" className="ded-photos__swap" aria-label={t.form.replacePhoto} title={t.form.replacePhoto}
                      disabled={replacingId !== null} onClick={() => { setSwapping(photo); swapInput.current?.click(); }}>🔄</button>
                    <button type="button" className="ded-photos__remove" aria-label={t.form.removePhoto}
                      onClick={() => void run(() => backend.dedications.deletePhoto(photo))}>✕</button>
                  </>
                )}
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => <div key={`up-${i}`} className="ded-photos__item is-loading" aria-hidden />)}
            {editing && photos.length + uploading < MAX_DEDICATION_PHOTOS && (
              <button type="button" className="ded-photos__add" onClick={() => fileInput.current?.click()}>{t.form.addPhotos}</button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addPhotos(e.target.files)} />
          <input ref={swapInput} type="file" accept="image/*" hidden onChange={(e) => void replacePhoto(e.target.files?.[0])} />
        </section>
      )}

      <section className="stack" aria-labelledby="dedication-songs">
        <div className="row-between">
          <h2 id="dedication-songs" className="dedication-page__heading">
            🎶 {t.form.songs} {songs.length > 0 && <span className="dedication-page__count">{songs.length}</span>}
          </h2>
          <div className="row">
            {songs.length > 0 && <button className="btn btn--sm" data-tour="dedication-play" onClick={() => player.play(queue, 0, { shuffle: false })}>{t.page.playAll}</button>}
            {editing && songs.length < MAX_DEDICATION_SONGS && <button className="btn btn--sm btn--ghost" onClick={() => setImporting(true)}>{t.page.importSongs}</button>}
          </div>
        </div>
        {songs.length === 0 && !editing && <p className="muted">{t.form.noSongs}</p>}
        {songs.length > 0 && (
          <ol className="song-list">
            {songs.map((song, index) => {
              const playing = player.current?.key === song.id;
              return (
                <li key={song.id} className={`song-list__item${playing ? " is-playing" : ""}`} aria-current={playing || undefined}>
                  <span className="song-list__number" aria-hidden>{playing ? "🔊" : index + 1}</span>
                  <span className="song-list__main"><SongLabel song={song} /></span>
                  {editing ? (
                    <span className="row song-list__edit">
                      <button type="button" className="btn btn--icon btn--ghost" aria-label={`${t.song.moveUp}: ${song.title}`} disabled={index === 0} onClick={() => move(song, -1)}>↑</button>
                      <button type="button" className="btn btn--icon btn--ghost" aria-label={`${t.song.moveDown}: ${song.title}`} disabled={index === songs.length - 1} onClick={() => move(song, 1)}>↓</button>
                      <button type="button" className="btn btn--icon btn--ghost" aria-label={`${t.song.remove}: ${song.title}`}
                        onClick={() => void run(() => backend.dedications.deleteSong(song))}>✕</button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn--icon btn--soft" aria-label={t.song.play(song.title)} onClick={() => player.play(queue, index, { shuffle: false })}>
                      <span aria-hidden>▶</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {editing && songs.length < MAX_DEDICATION_SONGS && (
          <div className="card">
            <SongAdder onAdd={async (draft) => {
              await saveSongDraft(backend, dedication.id, draft);
              await reload();
            }} />
          </div>
        )}
      </section>

      {viewing && <PhotoViewer path={viewing} onClose={() => setViewing(null)} />}
      {editingText && <EditDedicationModal dedication={dedication} people={people} onClose={() => setEditingText(false)} onSaved={() => void reload()} />}
      {importing && <ImportSongsModal mine={[item]} people={people} into={item} onClose={() => setImporting(false)} onDone={() => void reload()} />}
      {confirmElement}
    </main>
  );
}
