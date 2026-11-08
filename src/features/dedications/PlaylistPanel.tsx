/**
 * La playlist: todas las canciones de las dedicatorias que veo, para
 * reproducirlas aquí mismo o llevarlas a otra app (M3U, YouTube, Spotify,
 * texto) y para importar canciones de otras.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildPlaylist, plainList, spotifyLinks, toM3U, YOUTUBE_QUEUE_MAX, youtubeQueueUrl, songLink,
} from "@/domain/songs";
import type { DedicationWithMedia, Profile } from "@/domain/types";
import { useT } from "@/i18n";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState } from "@/ui/Feedback";
import { usePlayer, toPlayerTracks } from "@/features/player/PlayerContext";
import { ImportSongsModal } from "./ImportSongsModal";
import { downloadText, SongLabel } from "./parts";

interface Props {
  items: DedicationWithMedia[];
  people: Profile[];
  onChanged(): void;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PlaylistPanel({ items, people, onChanged }: Props) {
  const t = useT().dedications;
  const toast = useToast();
  const player = usePlayer();
  const { user } = useAuth();
  const [order, setOrder] = useState<"oldest" | "newest">("oldest");
  const [importing, setImporting] = useState(false);
  const tracks = useMemo(() => buildPlaylist(items, order), [items, order]);
  const queue = useMemo(() => toPlayerTracks(tracks), [tracks]);
  const songs = tracks.map((tr) => tr.song);
  const dedicationCount = new Set(tracks.map((tr) => tr.dedication.id)).size;
  const youtube = youtubeQueueUrl(songs);
  const youtubeCount = new Set(songs.map((s) => songLink(s)).filter((l) => l?.source === "youtube" && l.kind === "video").map((l) => l!.url)).size;
  const spotify = spotifyLinks(songs);
  const mine = items.filter((d) => d.dedication.authorId === user?.id);
  const p = t.playlist;

  const copied = async (text: string, success?: string) => {
    if (await copy(text)) toast.success(t.playlist.copied, success);
    else toast.error(p.copyFailed);
  };

  return (
    <section className="playlist stack" aria-labelledby="playlist-title">
      <div className="playlist__head row-between">
        <div>
          <h2 id="playlist-title" className="playlist__title">🎶 {p.m3uName}</h2>
          <p className="muted">{p.summary(tracks.length, dedicationCount)}</p>
        </div>
        <div className="row playlist__actions">
          <button className="btn" disabled={!queue.length} data-tour="dedication-play" onClick={() => player.play(queue, 0, { shuffle: false })}>{p.playAll}</button>
          <button className="btn btn--soft" disabled={!queue.length} onClick={() => player.play(queue, Math.floor(Math.random() * queue.length), { shuffle: true })}>{p.shuffle}</button>
          <button className="btn btn--ghost" onClick={() => setImporting(true)}>{p.import}</button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState icon="🎧" title={p.empty}>
          <p className="muted">{p.emptyHint}</p>
        </EmptyState>
      ) : (
        <>
          <div className="row playlist__order">
            <label className="field__label" htmlFor="playlist-order">{p.order}</label>
            <select id="playlist-order" className="input" value={order} onChange={(e) => setOrder(e.target.value as "oldest" | "newest")}>
              <option value="oldest">{p.oldest}</option>
              <option value="newest">{p.newest}</option>
            </select>
          </div>
          <ol className="song-list song-list--playlist">
            {tracks.map(({ song, dedication }, index) => {
              const playing = player.current?.key === song.id;
              return (
                <li key={song.id} className={`song-list__item${playing ? " is-playing" : ""}`} aria-current={playing || undefined}>
                  <span className="song-list__number" aria-hidden>{playing ? "🔊" : index + 1}</span>
                  <span className="song-list__main">
                    <SongLabel song={song} />
                    <Link className="song-list__from muted" to={`/dedicatorias/${dedication.id}`}>{dedication.emoji} {p.from(dedication.title)}</Link>
                  </span>
                  {playing && <span className="visually-hidden">{p.nowPlaying}</span>}
                  <button type="button" className="btn btn--icon btn--soft" aria-label={t.song.play(song.title)} onClick={() => player.play(queue, index, { shuffle: false })}>
                    <span aria-hidden>▶</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="card playlist__export stack" aria-labelledby="playlist-export">
            <h3 id="playlist-export">{p.exportTitle}</h3>
            <div className="playlist__export-grid">
              <div>
                <button type="button" className="btn btn--soft" onClick={() =>
                  downloadText(`${p.fileName}.m3u8`, toM3U(songs, { name: p.m3uName, uploadedNote: p.uploadedNote }), "audio/x-mpegurl;charset=utf-8")}>
                  {p.exportM3u}
                </button>
                <p className="muted">{p.exportM3uHint}</p>
              </div>
              <div>
                {youtube ? (
                  <a className="btn btn--soft" href={youtube} target="_blank" rel="noopener noreferrer">{p.openYouTube}</a>
                ) : <button type="button" className="btn btn--soft" disabled>{p.openYouTube}</button>}
                <p className="muted">
                  {youtube ? p.openYouTubeHint(Math.min(youtubeCount, YOUTUBE_QUEUE_MAX)) : p.noYouTube}
                  {youtubeCount > YOUTUBE_QUEUE_MAX && ` ${p.youtubeLimit(YOUTUBE_QUEUE_MAX)}`}
                </p>
              </div>
              <div>
                <button type="button" className="btn btn--soft" disabled={!spotify.length}
                  onClick={() => void copied(spotify.join("\n"), p.copiedCount(spotify.length))}>{p.copySpotify}</button>
                <p className="muted">{spotify.length ? p.copySpotifyHint : p.noSpotify}</p>
              </div>
              <div>
                <button type="button" className="btn btn--soft" onClick={() => void copied(plainList(songs))}>{p.copyList}</button>
                <p className="muted">{p.copyListHint}</p>
              </div>
            </div>
          </section>
        </>
      )}

      {importing && <ImportSongsModal mine={mine} people={people} onClose={() => setImporting(false)} onDone={onChanged} />}
    </section>
  );
}
