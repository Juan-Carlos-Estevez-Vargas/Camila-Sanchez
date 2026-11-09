/**
 * Canciones de las dedicatorias y la playlist que se arma con ellas.
 *
 * Nada de esto depende de la interfaz: reconoce enlaces de YouTube y Spotify,
 * arma la dirección del reproductor incrustado, ordena la playlist y la
 * convierte a (o la lee de) formatos que entienden otras apps: M3U, una cola
 * de YouTube, enlaces de Spotify o una lista de texto.
 */
import type { Dedication, DedicationSong, DedicationWithMedia, SongSource } from "./types";

export type SpotifyKind = "track" | "album" | "playlist" | "episode" | "show" | "artist";

/** Un enlace ya entendido: de dónde es y cómo se llama de forma canónica. */
export type ParsedSongLink =
  | { source: "youtube"; kind: "video" | "playlist"; id: string; url: string }
  | { source: "spotify"; kind: SpotifyKind; id: string; url: string }
  | { source: "link"; url: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const YOUTUBE_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_LIST = /^[A-Za-z0-9_-]{10,64}$/;
const SPOTIFY_KINDS: readonly SpotifyKind[] = ["track", "album", "playlist", "episode", "show", "artist"];
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_URI = /^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]{22})$/;

/** Máximo de caracteres de un enlace (igual que en la base de datos). */
export const MAX_SONG_URL = 500;

function youtube(url: URL): ParsedSongLink | null {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let video: string | null = null;
  if (host === "youtu.be") video = parts[0] ?? null;
  else if (parts[0] === "watch") video = url.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) video = parts[1] ?? null;
  if (video && YOUTUBE_VIDEO.test(video)) {
    return { source: "youtube", kind: "video", id: video, url: `https://www.youtube.com/watch?v=${video}` };
  }
  const list = url.searchParams.get("list");
  if (list && YOUTUBE_LIST.test(list) && (parts[0] === "playlist" || parts[0] === "watch" || parts[1] === "videoseries")) {
    return { source: "youtube", kind: "playlist", id: list, url: `https://www.youtube.com/playlist?list=${list}` };
  }
  return null;
}

function spotify(url: URL): ParsedSongLink | null {
  if (url.hostname.toLowerCase() !== "open.spotify.com") return null;
  // /intl-es/track/<id> y /embed/track/<id> también valen.
  const parts = url.pathname.split("/").filter((p) => p && !p.startsWith("intl-") && p !== "embed");
  const kind = parts[0] as SpotifyKind;
  const id = parts[1] ?? "";
  if (!SPOTIFY_KINDS.includes(kind) || !SPOTIFY_ID.test(id)) return null;
  return { source: "spotify", kind, id, url: `https://open.spotify.com/${kind}/${id}` };
}

/**
 * Entiende un enlace pegado por la persona. YouTube y Spotify quedan con su
 * dirección canónica (sin rastreadores como ?si=); cualquier otro enlace
 * https se guarda tal cual y se abre aparte. null si no es un enlace https.
 */
export function parseSongLink(raw: string): ParsedSongLink | null {
  const text = raw.trim();
  const uri = SPOTIFY_URI.exec(text);
  if (uri) return { source: "spotify", kind: uri[1] as SpotifyKind, id: uri[2]!, url: `https://open.spotify.com/${uri[1]}/${uri[2]}` };
  const withScheme = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(text) || /^open\.spotify\.com\//i.test(text) ? `https://${text}` : text;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
  const known = youtube(url) ?? spotify(url);
  if (known) return known;
  if (YOUTUBE_HOSTS.has(url.hostname.toLowerCase()) || url.hostname.toLowerCase() === "open.spotify.com") {
    // Es de YouTube o Spotify pero no apunta a algo que se pueda escuchar.
    return null;
  }
  const href = url.toString();
  return href.length <= MAX_SONG_URL ? { source: "link", url: href } : null;
}

/** El enlace guardado de una canción, entendido (null en archivos subidos). */
export function songLink(song: Pick<DedicationSong, "source" | "url">): ParsedSongLink | null {
  if (song.source === "audio" || !song.url) return null;
  return parseSongLink(song.url);
}

/**
 * Dirección del reproductor incrustado. Se arma sólo con el identificador ya
 * validado, nunca con el texto que pegó la persona.
 */
export function embedUrl(link: ParsedSongLink, origin: string): string | null {
  if (link.source === "youtube") {
    const params = new URLSearchParams({ autoplay: "1", enablejsapi: "1", playsinline: "1", rel: "0", origin });
    if (link.kind === "playlist") {
      params.set("list", link.id);
      return `https://www.youtube-nocookie.com/embed/videoseries?${params}`;
    }
    return `https://www.youtube-nocookie.com/embed/${link.id}?${params}`;
  }
  if (link.source === "spotify") return `https://open.spotify.com/embed/${link.kind}/${link.id}?utm_source=generator`;
  return null;
}

/** Orígenes que la CSP deja incrustar (frame-src). */
export const EMBED_ORIGINS = { youtube: "https://www.youtube-nocookie.com", spotify: "https://open.spotify.com" } as const;

// --- la playlist --------------------------------------------------------------

/** Una canción de la playlist con la dedicatoria de la que viene. */
export interface PlaylistTrack {
  song: DedicationSong;
  dedication: Dedication;
}

const byDay = (a: Dedication, b: Dedication) =>
  a.dedicatedOn.localeCompare(b.dedicatedOn) || a.createdAt.localeCompare(b.createdAt);

export const bySongPosition = (a: DedicationSong, b: DedicationSong) =>
  a.position - b.position || a.createdAt.localeCompare(b.createdAt);

/**
 * Todas las canciones de las dedicatorias que veo, como una sola playlist:
 * de la dedicatoria más vieja a la más nueva («nuestra historia en
 * canciones») o al revés.
 */
export function buildPlaylist(items: readonly DedicationWithMedia[], order: "oldest" | "newest" = "oldest"): PlaylistTrack[] {
  const sorted = [...items].sort((a, b) => byDay(a.dedication, b.dedication));
  if (order === "newest") sorted.reverse();
  return sorted.flatMap(({ dedication, songs }) => [...songs].sort(bySongPosition).map((song) => ({ song, dedication })));
}

/**
 * Orden aleatorio que empieza por la canción elegida (Fisher-Yates).
 * `random` se inyecta para poder probarlo.
 */
export function shuffledOrder(length: number, first: number, random: () => number = Math.random): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return length > 0 && first >= 0 && first < length ? [first, ...rest] : rest;
}

/** «Artista - Título», o sólo el título si no hay artista. */
export function songLabel(song: Pick<DedicationSong, "title" | "artist">): string {
  const artist = song.artist.trim();
  return artist ? `${artist} - ${song.title.trim()}` : song.title.trim();
}

// --- exportar -----------------------------------------------------------------

type ExportSong = Pick<DedicationSong, "title" | "artist" | "source" | "url">;

/** Una línea de M3U no puede tener saltos de línea. */
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

/**
 * Playlist en formato M3U (UTF-8, .m3u8): la abren VLC, Winamp, foobar2000,
 * Kodi y las apps que importan playlists. Los archivos subidos a la app no
 * tienen un enlace permanente, así que quedan como comentario.
 */
export function toM3U(songs: readonly ExportSong[], options: { name: string; uploadedNote: string }): string {
  const lines = ["#EXTM3U", `#PLAYLIST:${oneLine(options.name)}`];
  for (const song of songs) {
    const label = oneLine(songLabel(song));
    if (song.source === "audio" || !song.url) {
      lines.push(`# ${label} (${oneLine(options.uploadedNote)})`);
      continue;
    }
    lines.push(`#EXTINF:-1,${label}`, song.url);
  }
  return `${lines.join("\n")}\n`;
}

/** YouTube arma una lista con hasta 50 videos a partir de sus ids. */
export const YOUTUBE_QUEUE_MAX = 50;

/**
 * Enlace que abre en YouTube una lista con todos los videos (se puede
 * guardar como playlist desde ahí). null si no hay ninguno.
 */
export function youtubeQueueUrl(songs: readonly ExportSong[]): string | null {
  const ids: string[] = [];
  for (const song of songs) {
    const link = songLink(song);
    if (link?.source === "youtube" && link.kind === "video" && !ids.includes(link.id)) ids.push(link.id);
  }
  return ids.length ? `https://www.youtube.com/watch_videos?video_ids=${ids.slice(0, YOUTUBE_QUEUE_MAX).join(",")}` : null;
}

/** Enlaces de Spotify, uno por línea: se pegan en una playlist de Spotify (Ctrl+V). */
export function spotifyLinks(songs: readonly ExportSong[]): string[] {
  const links: string[] = [];
  for (const song of songs) {
    const link = songLink(song);
    if (link?.source === "spotify" && !links.includes(link.url)) links.push(link.url);
  }
  return links;
}

/** «1. Artista - Título» por línea, para buscarlas en cualquier app o pegarlas en un convertidor. */
export function plainList(songs: readonly ExportSong[]): string {
  return songs.map((s, i) => `${i + 1}. ${oneLine(songLabel(s))}`).join("\n");
}

// --- importar -----------------------------------------------------------------

export interface ImportedSong {
  title: string;
  artist: string;
  url: string;
  source: Exclude<SongSource, "audio">;
}

export interface ImportResult {
  songs: ImportedSong[];
  /** Líneas con algo escrito que no traían un enlace que sirva. */
  skipped: number;
}

/** Hasta cuántas canciones se importan de una vez. */
export const MAX_IMPORT = 100;

const URL_IN_LINE = /(spotify:(?:track|album|playlist|episode|show|artist):[A-Za-z0-9]{22}|https?:\/\/\S+|(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/\S+|open\.spotify\.com\/\S+)/i;
const SEPARATORS = /^[\s|·•:,;."'«»\-–—]+|[\s|·•:,;."'«»\-–—]+$/g;

/** «Artista - Título» (la convención de M3U) en sus dos partes. */
export function splitLabel(label: string): { artist: string; title: string } {
  const clean = label.replace(SEPARATORS, "").replace(/^\d+[.)]\s+/, "").trim();
  const match = /\s[-–—]\s/.exec(clean);
  if (!match) return { artist: "", title: clean };
  return { artist: clean.slice(0, match.index).trim(), title: clean.slice(match.index + match[0].length).trim() };
}

/**
 * Lee una playlist pegada o abierta desde un archivo: un .m3u/.m3u8 (con
 * #EXTINF) o simplemente enlaces de YouTube o Spotify, uno por línea, con
 * «Artista - Título» antes o después si se quiere. Repetidas se cuentan una vez.
 */
export function parsePlaylistText(text: string, max = MAX_IMPORT): ImportResult {
  const songs: ImportedSong[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let info: string | null = null;
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#EXTINF:/i.test(line)) {
      const comma = line.indexOf(",");
      info = comma >= 0 ? line.slice(comma + 1).trim() : null;
      continue;
    }
    if (line.startsWith("#")) continue;
    const found = URL_IN_LINE.exec(line);
    // «(https://…).» → el enlace sin la puntuación que lo rodea.
    const urlText = found ? found[1]!.replace(/[),.;\]]+$/, "") : "";
    const link = urlText ? parseSongLink(urlText) : null;
    if (!link) {
      skipped++;
      info = null;
      continue;
    }
    // Sin el enlace (y sin los paréntesis vacíos que deja) queda «Artista - Título».
    const rest = info ?? line.replace(urlText, " ").replace(/\(\s*\)|\[\s*\]/g, " ");
    info = null;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    if (songs.length >= max) {
      skipped++;
      continue;
    }
    songs.push({ ...splitLabel(rest), url: link.url, source: link.source });
  }
  return { songs, skipped };
}

// --- archivos de audio --------------------------------------------------------

/** Peso máximo de un audio subido (igual que el bucket). */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** Extensión con la que se guarda → tipo con el que se sube. */
export const AUDIO_TYPES = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
  flac: "audio/flac",
} as const;

export type AudioExtension = keyof typeof AUDIO_TYPES;

const MIME_TO_EXTENSION: Record<string, AudioExtension> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/aac": "aac", "audio/x-aac": "aac",
  "audio/ogg": "ogg", "audio/opus": "opus",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac", "audio/x-flac": "flac",
};

/** Con qué extensión se guarda un archivo de audio (null si no es uno que se acepte). */
export function audioExtension(file: { name: string; type: string }): AudioExtension | null {
  const byType = MIME_TO_EXTENSION[file.type.toLowerCase()];
  if (byType) return byType;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "oga") return "ogg";
  return ext in AUDIO_TYPES ? (ext as AudioExtension) : null;
}

/** «Artista - Canción.mp3» → artista y título para rellenar el formulario. */
export function songFromFileName(name: string): { artist: string; title: string } {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();
  return splitLabel(base);
}
