/**
 * Música suave de fondo en una fecha especial.
 *
 * Los navegadores no dejan sonar nada hasta que la persona toca la página,
 * así que la música empieza con el primer toque o tecla. Al llegar sale un
 * aviso que dice cómo apagarla, y abajo a la izquierda queda el botón 🔊/🔇.
 * «Apagar» se recuerda sólo ese día en ese navegador: la próxima fecha
 * especial vuelve a sonar.
 *
 * Suena la melodía de la fecha (cajita musical, services/audio/musicBox.ts)
 * o, si en Apariencia pusieron canciones (la serenata del cumpleaños), esas:
 * videos de YouTube en una tarjetita con el video, o archivos de audio. Nunca
 * en el chat, y se pausa si empieza la playlist o la música de la portada.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { embedUrl, EMBED_ORIGINS } from "@/domain/songs";
import { musicDayKey, parseMusicLink, SPECIAL_TUNES, type MusicLink } from "@/domain/specialMusic";
import type { SpecialDayId } from "@/domain/specialDays";
import { useT } from "@/i18n";
import { claimAudio, onAudioClaimed } from "@/services/audio/audioFocus";
import { createMusicBox, type MusicBox } from "@/services/audio/musicBox";
import { usePlayer } from "@/features/player/PlayerContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { useSpecialDay } from "@/state/SpecialDayContext";

const OFF_KEY = "special-music-off";
const NOTICE_KEY = "special-music-notice";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento sólo se recuerda mientras la página siga abierta.
  }
}

/** Un video de YouTube que, al terminar, pasa a la próxima canción. */
function YouTubeSong({ song, title, onEnded }: { song: Extract<MusicLink, { kind: "youtube" }>; title: string; onEnded(): void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => embedUrl(song.link, window.location.origin), [song.link]);

  const send = useCallback((data: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ id: 1, channel: "widget", ...data }), EMBED_ORIGINS.youtube);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGINS.youtube || event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: unknown };
      try {
        data = (typeof event.data === "string" ? JSON.parse(event.data) : event.data) as typeof data;
      } catch {
        return;
      }
      const info = data.info as { playerState?: number } | number | null | undefined;
      const state = data.event === "onStateChange" && typeof info === "number" ? info
        : data.event === "infoDelivery" && info && typeof info === "object" ? info.playerState : undefined;
      if (state === 0) onEnded();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onEnded]);

  if (!src) return null;
  return (
    <div className="special-music__video">
      <iframe
        ref={frame}
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => {
          send({ event: "listening" });
          send({ event: "command", func: "addEventListener", args: ["onStateChange"] });
          // De fondo: un poco más bajito.
          send({ event: "command", func: "setVolume", args: [60] });
        }}
      />
    </div>
  );
}

function AudioSong({ url, onEnded }: { url: string; onEnded(): void }) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audio.current) audio.current.volume = 0.5;
  }, [url]);
  return <audio ref={audio} className="special-music__audio" src={url} autoPlay onEnded={onEnded} onError={onEnded} />;
}

function Music({ id, songs, dayKey }: { id: SpecialDayId; songs: MusicLink[]; dayKey: string }) {
  const t = useT().special.music;
  const player = usePlayer();
  const [muted, setMuted] = useState(() => read(OFF_KEY) === dayKey);
  const [noticeSeen, setNoticeSeen] = useState(() => read(NOTICE_KEY) === dayKey);
  const [playing, setPlaying] = useState(false);
  /** Ya sonó una vez: desde ahí sólo manda el botón. */
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const box = useRef<MusicBox | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const useTune = songs.length === 0;
  const hasPlaylist = !!player.current;

  // La cajita de esta fecha (se suelta al cambiar de fecha o al salir).
  useEffect(() => {
    if (!useTune) return;
    const created = createMusicBox(SPECIAL_TUNES[id]);
    box.current = created;
    return () => {
      created.dispose();
      if (box.current === created) box.current = null;
    };
  }, [id, useTune]);

  /** Empieza a sonar. Se llama dentro de un toque, que es cuando el navegador lo deja. */
  const start = useCallback(() => {
    claimAudio("special");
    setStarted(true);
    setPlaying(true);
    if (box.current) {
      void box.current.start().then((ok) => {
        if (!ok) setPlaying(false);
      });
    }
  }, []);

  const stop = useCallback(() => {
    box.current?.pause();
    setPlaying(false);
  }, []);

  // Si empieza otra música (la playlist o la de la portada), ésta se pausa.
  useEffect(() => onAudioClaimed("special", stop), [stop]);

  // El primer toque o tecla en cualquier parte de la página la hace sonar.
  useEffect(() => {
    if (muted || started || hasPlaylist) return;
    const onFirst = (event: Event) => {
      // El botón y el aviso hacen lo suyo.
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      start();
    };
    const options = { capture: true } as const;
    window.addEventListener("pointerdown", onFirst, options);
    window.addEventListener("keydown", onFirst, options);
    return () => {
      window.removeEventListener("pointerdown", onFirst, options);
      window.removeEventListener("keydown", onFirst, options);
    };
  }, [muted, started, hasPlaylist, start]);

  const dismissNotice = () => {
    write(NOTICE_KEY, dayKey);
    setNoticeSeen(true);
  };

  const turnOff = () => {
    write(OFF_KEY, dayKey);
    setMuted(true);
    stop();
  };

  const turnOn = () => {
    write(OFF_KEY, null);
    setMuted(false);
    start();
  };

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(songs.length, 1)), [songs.length]);
  const song = songs[index % Math.max(songs.length, 1)];
  const name = t.what[id];

  return (
    <div ref={root} className="special-music" data-special-music>
      {!noticeSeen && (
        <div className="special-music__notice card" role="status">
          <p>
            <span aria-hidden>🎶 </span>
            {t.notice(name)}
          </p>
          <div className="special-music__actions">
            <button type="button" className="btn btn--sm"
              onClick={() => {
                dismissNotice();
                if (!muted && !playing) start();
              }}>
              {muted || playing ? t.ok : t.listen}
            </button>
            {!muted && (
              <button type="button" className="btn btn--sm btn--ghost"
                onClick={() => {
                  dismissNotice();
                  turnOff();
                }}>
                {t.turnOff}
              </button>
            )}
          </div>
        </div>
      )}

      {playing && song && (
        <div className="special-music__stage card">
          {song.kind === "youtube"
            ? <YouTubeSong key={`${song.url}:${index}`} song={song} title={t.frameTitle(name)} onEnded={next} />
            : <AudioSong key={`${song.url}:${index}`} url={song.url} onEnded={next} />}
          {songs.length > 1 && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={next} aria-label={t.next}>
              ⏭ <span className="special-music__count">{t.position(index % songs.length + 1, songs.length)}</span>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="special-music__toggle btn btn--icon"
        aria-pressed={playing}
        aria-label={playing ? t.pause(name) : t.play(name)}
        title={playing ? t.pause(name) : t.play(name)}
        onClick={() => (playing ? turnOff() : turnOn())}
      >
        <span aria-hidden>{playing ? "🔊" : "🔇"}</span>
      </button>
    </div>
  );
}

/** Monta la música de la fecha de hoy (o la de la vista previa). */
export function SpecialDayMusic() {
  const { day, preview } = useSpecialDay();
  const { content } = useSiteContent();
  const { pathname } = useLocation();
  const config = content?.settings.effects.specialDays;
  const id = day?.id ?? null;
  const urls = (id && config?.songs[id]) || null;
  const songs = useMemo(() => (urls ?? []).flatMap((u) => parseMusicLink(u) ?? []), [urls]);
  if (!day || !config?.music) return null;
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;
  const dayKey = musicDayKey(day.id, new Date(), preview);
  // La clave hace que todo vuelva a empezar si cambia la fecha o sus canciones.
  return <Music key={`${dayKey}|${songs.map((s) => s.url).join(" ")}`} id={day.id} songs={songs} dayKey={dayKey} />;
}
