/**
 * Reproductor flotante de la playlist. Suena:
 *   - YouTube incrustado (youtube-nocookie) y, al terminar el video, sigue
 *     con la próxima (la API del iframe avisa por postMessage);
 *   - Spotify incrustado (Spotify no avisa cuándo termina: se pasa con ⏭);
 *   - archivos de audio subidos, con <audio> y los controles del celular
 *     (Media Session) en la pantalla de bloqueo;
 *   - otros enlaces: se ofrecen para abrir aparte.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { embedUrl, EMBED_ORIGINS, songLink, type ParsedSongLink } from "@/domain/songs";
import { useT } from "@/i18n";
import { claimAudio, onAudioClaimed } from "@/services/audio/audioFocus";
import { useBackend } from "@/state/BackendContext";
import { usePlayer, type PlayerTrack } from "./PlayerContext";
import "./player.scss";

/** Lo que el reproductor de cada tipo deja controlar desde la barra. */
interface StageControls {
  setPlaying(play: boolean): void;
}

interface StageProps {
  track: PlayerTrack;
  onEnded(): void;
  register(controls: StageControls | null): void;
  onPlaying(playing: boolean): void;
}

type YouTubeMessage = { event?: string; info?: number | { playerState?: number } | null };

function YouTubeStage({ link, track, onEnded, register, onPlaying }: StageProps & { link: ParsedSongLink }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ended = useRef(false);
  const src = useMemo(() => embedUrl(link, window.location.origin), [link]);
  const t = useT().dedications.player;

  const send = useCallback((data: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ id: 1, channel: "widget", ...data }), EMBED_ORIGINS.youtube);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGINS.youtube || event.source !== frame.current?.contentWindow) return;
      let data: YouTubeMessage;
      try {
        data = (typeof event.data === "string" ? JSON.parse(event.data) : event.data) as YouTubeMessage;
      } catch {
        return;
      }
      const state = data.event === "onStateChange" && typeof data.info === "number" ? data.info
        : data.event === "infoDelivery" && data.info && typeof data.info === "object" ? data.info.playerState : undefined;
      if (state === 1) {
        onPlaying(true);
        claimAudio("playlist");
      } else if (state === 2 || state === 0) {
        onPlaying(false);
      }
      // 0 = terminó.
      if (state === 0 && !ended.current) {
        ended.current = true;
        onEnded();
      }
    };
    window.addEventListener("message", onMessage);
    register({ setPlaying: (play) => send({ event: "command", func: play ? "playVideo" : "pauseVideo", args: [] }) });
    return () => {
      window.removeEventListener("message", onMessage);
      register(null);
    };
  }, [send, onEnded, register, onPlaying]);

  if (!src) return null;
  return (
    <div className="mini-player__video">
      <iframe
        ref={frame}
        src={src}
        title={t.frameTitle(track.title)}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => {
          // Pide los cambios de estado (sonando, en pausa, terminó).
          send({ event: "listening" });
          send({ event: "command", func: "addEventListener", args: ["onStateChange"] });
        }}
      />
    </div>
  );
}

function SpotifyStage({ link, track }: { link: ParsedSongLink; track: PlayerTrack }) {
  const t = useT().dedications.player;
  const src = embedUrl(link, window.location.origin);
  if (!src) return null;
  const compact = link.source === "spotify" && (link.kind === "track" || link.kind === "episode");
  return (
    <>
      <iframe
        className={`mini-player__spotify${compact ? " is-compact" : ""}`}
        src={src}
        title={t.frameTitle(track.title)}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="eager"
      />
      <p className="mini-player__note muted">{t.spotifyNote}</p>
    </>
  );
}

function AudioStage({ track, onEnded, register, onPlaying }: StageProps) {
  const backend = useBackend();
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const t = useT().dedications.player;
  const path = track.audioPath;

  useEffect(() => {
    if (!path) return;
    let active = true;
    backend.dedications.resolveMedia([path])
      .then((found) => {
        if (!active) return;
        const resolved = found.get(path) ?? null;
        setUrl(resolved);
        setFailed(!resolved);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [backend, path]);

  useEffect(() => {
    register({
      setPlaying: (play) => {
        if (play) void audio.current?.play().catch(() => undefined);
        else audio.current?.pause();
      },
    });
    return () => register(null);
  }, [register]);

  if (failed) return <p className="mini-player__note">{t.audioFailed}</p>;
  if (!url) return <p className="mini-player__note muted">{t.loading}</p>;
  return (
    <audio
      ref={audio}
      className="mini-player__audio"
      src={url}
      controls
      autoPlay
      onPlay={() => {
        onPlaying(true);
        claimAudio("playlist");
      }}
      onPause={() => onPlaying(false)}
      onEnded={onEnded}
      onError={() => setFailed(true)}
    />
  );
}

function LinkStage({ track }: { track: PlayerTrack }) {
  const t = useT().dedications;
  if (!track.url) return null;
  return (
    <div className="mini-player__link">
      <p className="muted">{t.player.linkOnly}</p>
      <a className="btn btn--sm btn--soft" href={track.url} target="_blank" rel="noopener noreferrer" aria-label={t.song.openLabel(track.title)}>
        {t.song.open}
      </a>
    </div>
  );
}

function Stage(props: StageProps) {
  const link = songLink(props.track);
  if (props.track.source === "audio") return <AudioStage {...props} />;
  if (link?.source === "youtube") return <YouTubeStage {...props} link={link} />;
  if (link?.source === "spotify") return <SpotifyStage link={link} track={props.track} />;
  return <LinkStage track={props.track} />;
}

/** Título, artista y botones ⏮ ⏭ en la pantalla de bloqueo del celular. */
function useMediaSession(track: PlayerTrack | null, next: () => void, previous: () => void) {
  useEffect(() => {
    if (!track || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title, artist: track.artist, album: `${track.emoji} ${track.dedicationTitle}`,
        artwork: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      });
      navigator.mediaSession.setActionHandler("nexttrack", next);
      navigator.mediaSession.setActionHandler("previoustrack", previous);
    } catch {
      /* navegador sin Media Session completa */
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch {
        /* nada */
      }
    };
  }, [track, next, previous]);
}

export default function MiniPlayer() {
  const player = usePlayer();
  const { current, queue, order, cursor, shuffle, minimized, next, previous } = player;
  const { pathname } = useLocation();
  const t = useT().dedications.player;
  const [showQueue, setShowQueue] = useState(false);
  const [playing, setPlaying] = useState(false);
  const controls = useRef<StageControls | null>(null);
  const [canControl, setCanControl] = useState(false);
  // En el chat (pantalla completa) el reproductor queda chiquito arriba.
  const inChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const compact = minimized || inChat;

  const register = useCallback((c: StageControls | null) => {
    controls.current = c;
    setCanControl(!!c);
  }, []);

  useMediaSession(current, next, previous);

  // Cada canción empieza sin saber todavía si está sonando.
  const currentKey = current ? `${current.key}:${cursor}` : "";
  useEffect(() => setPlaying(false), [currentKey]);

  // Si empieza la música de fondo de la página, la playlist se pausa.
  useEffect(() => onAudioClaimed("playlist", () => controls.current?.setPlaying(false)), []);

  // Deja espacio abajo para que el reproductor no tape el final de la página.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.player = compact ? "min" : "open";
    return () => {
      delete root.dataset.player;
    };
  }, [compact]);

  if (!current) return null;
  const upcoming = order.map((index, position) => ({ track: queue[index]!, position }));

  return (
    <section className={`mini-player card${compact ? " is-min" : ""}${inChat ? " is-chat" : ""}`} aria-label={t.region}>
      <div className="mini-player__bar">
        <span className="mini-player__emoji" aria-hidden>{current.emoji}</span>
        <div className="mini-player__info">
          <strong className="mini-player__title">{current.title}</strong>
          <span className="mini-player__meta muted">
            {current.artist && <>{current.artist} · </>}
            <Link to={`/dedicatorias/${current.dedicationId}`}>{t.from(current.dedicationTitle)}</Link>
          </span>
        </div>
        <div className="mini-player__controls">
          <button type="button" className="btn btn--icon btn--ghost" onClick={previous} aria-label={t.previous}><span aria-hidden>⏮</span></button>
          {canControl && (
            <button type="button" className="btn btn--icon btn--ghost" aria-label={playing ? t.pause : t.play}
              onClick={() => controls.current?.setPlaying(!playing)}>
              <span aria-hidden>{playing ? "❚❚" : "▶"}</span>
            </button>
          )}
          <button type="button" className="btn btn--icon btn--ghost" onClick={next} aria-label={t.next}><span aria-hidden>⏭</span></button>
          <button type="button" className={`btn btn--icon btn--ghost${shuffle ? " is-active" : ""}`} aria-pressed={shuffle}
            aria-label={shuffle ? t.shuffleOn : t.shuffleOff} onClick={player.toggleShuffle}><span aria-hidden>🔀</span></button>
          {!inChat && (
            <button type="button" className="btn btn--icon btn--ghost" aria-label={minimized ? t.expand : t.minimize}
              aria-expanded={!minimized} onClick={() => player.setMinimized(!minimized)}>
              <span aria-hidden>{minimized ? "▴" : "▾"}</span>
            </button>
          )}
          <button type="button" className="btn btn--icon btn--ghost" onClick={player.close} aria-label={t.close}><span aria-hidden>✕</span></button>
        </div>
      </div>
      {/* Achicado se esconde, pero sigue montado para que no deje de sonar. */}
      <div className="mini-player__stage" aria-hidden={compact || undefined}>
        <Stage key={`${current.key}:${cursor}`} track={current} onEnded={next} register={register} onPlaying={setPlaying} />
      </div>
      {!compact && (
        <div className="mini-player__footer">
          <span className="muted">{t.position(cursor + 1, order.length)}</span>
          {order.length > 1 && (
            <button type="button" className="btn btn--sm btn--ghost" aria-expanded={showQueue} onClick={() => setShowQueue((v) => !v)}>
              {showQueue ? t.hideQueue : t.queue(order.length)}
            </button>
          )}
        </div>
      )}
      {!compact && showQueue && (
        <ol className="mini-player__queue">
          {upcoming.map(({ track, position }) => (
            <li key={`${track.key}:${position}`}>
              <button type="button" className={position === cursor ? "is-current" : ""} aria-current={position === cursor || undefined}
                onClick={() => player.jump(position)}>
                <span className="mini-player__queue-title">{track.title}</span>
                {track.artist && <span className="muted"> · {track.artist}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
