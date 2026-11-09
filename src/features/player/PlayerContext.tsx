/**
 * Reproductor de la playlist para toda la app: la cola, cuál suena, el modo
 * aleatorio y si está achicado. Vive arriba de las rutas, así la música sigue
 * aunque se cambie de página. El reproductor visible (MiniPlayer) se carga
 * sólo cuando hay algo sonando.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { shuffledOrder, type PlaylistTrack } from "@/domain/songs";
import type { SongSource, Uuid } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";

const MiniPlayer = lazy(() => import("./MiniPlayer"));

/** Lo que el reproductor necesita de cada canción. */
export interface PlayerTrack {
  /** Id de la canción. */
  key: Uuid;
  title: string;
  artist: string;
  source: SongSource;
  url: string | null;
  audioPath: string | null;
  dedicationId: Uuid;
  dedicationTitle: string;
  emoji: string;
}

export function toPlayerTracks(tracks: readonly PlaylistTrack[]): PlayerTrack[] {
  return tracks.map(({ song, dedication }) => ({
    key: song.id, title: song.title, artist: song.artist, source: song.source, url: song.url, audioPath: song.audioPath,
    dedicationId: dedication.id, dedicationTitle: dedication.title, emoji: dedication.emoji,
  }));
}

interface PlayerState {
  queue: PlayerTrack[];
  /** Orden en que suenan (índices de queue). */
  order: number[];
  /** Posición dentro de order. */
  cursor: number;
  shuffle: boolean;
  minimized: boolean;
}

export interface Player extends PlayerState {
  current: PlayerTrack | null;
  /** Empieza a sonar `tracks` desde `start`. */
  play(tracks: PlayerTrack[], start?: number, options?: { shuffle?: boolean }): void;
  /** Salta a una posición de la cola (en el orden en que suenan). */
  jump(cursor: number): void;
  next(): void;
  previous(): void;
  toggleShuffle(): void;
  setMinimized(minimized: boolean): void;
  close(): void;
}

const EMPTY: PlayerState = { queue: [], order: [], cursor: 0, shuffle: false, minimized: false };

const PlayerContext = createContext<Player | null>(null);

const straight = (length: number) => Array.from({ length }, (_, i) => i);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PlayerState>(EMPTY);

  // Al salir de la cuenta se apaga.
  useEffect(() => {
    if (!user) setState(EMPTY);
  }, [user]);

  const play = useCallback((tracks: PlayerTrack[], start = 0, options: { shuffle?: boolean } = {}) => {
    if (tracks.length === 0) return;
    setState((s) => {
      const shuffle = options.shuffle ?? s.shuffle;
      const first = Math.min(Math.max(start, 0), tracks.length - 1);
      const order = shuffle ? shuffledOrder(tracks.length, first) : straight(tracks.length);
      return { queue: tracks, order, cursor: shuffle ? 0 : first, shuffle, minimized: false };
    });
  }, []);

  // Al llegar al final vuelve a empezar: es una playlist para dejar sonando.
  const step = useCallback((delta: number) => {
    setState((s) => (s.order.length ? { ...s, cursor: (s.cursor + delta + s.order.length) % s.order.length } : s));
  }, []);

  const value = useMemo<Player>(() => ({
    ...state,
    current: state.queue[state.order[state.cursor] ?? -1] ?? null,
    play,
    jump: (cursor) => setState((s) => (cursor >= 0 && cursor < s.order.length ? { ...s, cursor } : s)),
    next: () => step(1),
    previous: () => step(-1),
    toggleShuffle: () => setState((s) => {
      if (!s.queue.length) return { ...s, shuffle: !s.shuffle };
      const playing = s.order[s.cursor] ?? 0;
      return s.shuffle
        ? { ...s, shuffle: false, order: straight(s.queue.length), cursor: playing }
        : { ...s, shuffle: true, order: shuffledOrder(s.queue.length, playing), cursor: 0 };
    }),
    setMinimized: (minimized) => setState((s) => ({ ...s, minimized })),
    close: () => setState(EMPTY),
  }), [state, play, step]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {value.current && (
        <Suspense fallback={null}>
          <MiniPlayer />
        </Suspense>
      )}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): Player {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer necesita <PlayerProvider>");
  return player;
}
