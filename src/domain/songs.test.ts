import { describe, expect, it } from "vitest";
import {
  audioExtension, buildPlaylist, embedUrl, parsePlaylistText, parseSongLink, plainList, shuffledOrder, songFromFileName,
  spotifyLinks, splitLabel, toM3U, youtubeQueueUrl,
} from "./songs";
import { canSeeDedication, filterDedications, sortDedications } from "./dedications";
import type { Dedication, DedicationSong, DedicationWithMedia } from "./types";

const TRACK = "4cOdK2wGLETKBW3PvgPWqT";

describe("enlaces de canciones", () => {
  it("entiende los enlaces de YouTube y los deja canónicos", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(parseSongLink(url)).toEqual({ source: "youtube", kind: "video", id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    }
    expect(parseSongLink("https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG")).toMatchObject({ kind: "playlist" });
  });

  it("entiende Spotify (con idioma, rastreadores o como URI)", () => {
    const expected = { source: "spotify", kind: "track", id: TRACK, url: `https://open.spotify.com/track/${TRACK}` };
    expect(parseSongLink(`https://open.spotify.com/track/${TRACK}?si=123`)).toEqual(expected);
    expect(parseSongLink(`https://open.spotify.com/intl-es/track/${TRACK}`)).toEqual(expected);
    expect(parseSongLink(`spotify:track:${TRACK}`)).toEqual(expected);
    expect(parseSongLink(`https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`)).toMatchObject({ kind: "playlist" });
  });

  it("otros enlaces https se guardan tal cual; http, javascript o rotos no", () => {
    expect(parseSongLink("https://soundcloud.com/artista/cancion")).toEqual({ source: "link", url: "https://soundcloud.com/artista/cancion" });
    expect(parseSongLink("http://example.com/a.mp3")).toBeNull();
    expect(parseSongLink("javascript:alert(1)")).toBeNull();
    expect(parseSongLink("https://user:pw@example.com")).toBeNull();
    expect(parseSongLink("no es un enlace")).toBeNull();
    // De YouTube o Spotify pero sin nada que escuchar.
    expect(parseSongLink("https://www.youtube.com/feed/trending")).toBeNull();
    expect(parseSongLink("https://open.spotify.com/track/corto")).toBeNull();
  });

  it("el reproductor incrustado se arma sólo con el id validado", () => {
    const yt = parseSongLink("https://youtu.be/dQw4w9WgXcQ")!;
    expect(embedUrl(yt, "https://camila.app")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&enablejsapi=1&playsinline=1&rel=0&origin=https%3A%2F%2Fcamila.app",
    );
    expect(embedUrl(parseSongLink(`spotify:album:${TRACK}`)!, "x")).toBe(`https://open.spotify.com/embed/album/${TRACK}?utm_source=generator`);
    expect(embedUrl(parseSongLink("https://soundcloud.com/a/b")!, "x")).toBeNull();
  });
});

const dedication = (id: string, dedicatedOn: string, createdAt = "2026-01-01T00:00:00Z", extra: Partial<Dedication> = {}): Dedication => ({
  id, authorId: "juan", recipientId: "cami", title: id, message: "", emoji: "💌", dedicatedOn, createdAt, updatedAt: createdAt, ...extra,
});
const song = (id: string, position: number, extra: Partial<DedicationSong> = {}): DedicationSong => ({
  id, dedicationId: "", title: id, artist: "", note: "", source: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  audioPath: null, position, createdAt: "2026-01-01T00:00:00Z", ...extra,
});
const withSongs = (d: Dedication, songs: DedicationSong[]): DedicationWithMedia => ({ dedication: d, photos: [], songs, views: [] });

describe("playlist", () => {
  const items = [
    withSongs(dedication("nueva", "2026-05-01"), [song("n2", 2), song("n1", 1)]),
    withSongs(dedication("vieja", "2025-02-14"), [song("v1", 1)]),
    withSongs(dedication("sin canciones", "2025-06-01"), []),
  ];

  it("junta las canciones de la dedicatoria más vieja a la más nueva, cada una en su orden", () => {
    expect(buildPlaylist(items).map((t) => t.song.id)).toEqual(["v1", "n1", "n2"]);
    expect(buildPlaylist(items).map((t) => t.dedication.id)).toEqual(["vieja", "nueva", "nueva"]);
    expect(buildPlaylist(items, "newest").map((t) => t.song.id)).toEqual(["n1", "n2", "v1"]);
  });

  it("el modo aleatorio empieza por la elegida y no repite ni pierde ninguna", () => {
    let seed = 0.3;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const order = shuffledOrder(6, 4, random);
    expect(order[0]).toBe(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shuffledOrder(0, 0)).toEqual([]);
  });
});

describe("exportar", () => {
  const songs = [
    song("Perfect", 1, { artist: "Ed Sheeran", url: "https://www.youtube.com/watch?v=2Vv-BfVoq4g" }),
    song("Yellow", 2, { artist: "Coldplay", source: "spotify", url: `https://open.spotify.com/track/${TRACK}` }),
    song("Nuestra", 3, { source: "audio", url: null, audioPath: "a/b.mp3" }),
    song("Otra\nlínea", 4, { source: "link", url: "https://soundcloud.com/a/b" }),
  ];

  it("M3U con #EXTINF; los archivos subidos quedan como comentario", () => {
    expect(toM3U(songs, { name: "Nuestra playlist", uploadedNote: "archivo de la app" })).toBe([
      "#EXTM3U",
      "#PLAYLIST:Nuestra playlist",
      "#EXTINF:-1,Ed Sheeran - Perfect",
      "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
      "#EXTINF:-1,Coldplay - Yellow",
      `https://open.spotify.com/track/${TRACK}`,
      "# Nuestra (archivo de la app)",
      "#EXTINF:-1,Otra línea",
      "https://soundcloud.com/a/b",
      "",
    ].join("\n"));
  });

  it("cola de YouTube, enlaces de Spotify y lista de texto", () => {
    expect(youtubeQueueUrl(songs)).toBe("https://www.youtube.com/watch_videos?video_ids=2Vv-BfVoq4g");
    expect(youtubeQueueUrl([songs[2]!])).toBeNull();
    expect(spotifyLinks(songs)).toEqual([`https://open.spotify.com/track/${TRACK}`]);
    expect(plainList(songs.slice(0, 2))).toBe("1. Ed Sheeran - Perfect\n2. Coldplay - Yellow");
  });

  it("lo exportado se vuelve a importar igual", () => {
    const back = parsePlaylistText(toM3U(songs, { name: "x", uploadedNote: "y" }));
    expect(back.songs.map((s) => [s.artist, s.title, s.source])).toEqual([
      ["Ed Sheeran", "Perfect", "youtube"], ["Coldplay", "Yellow", "spotify"], ["", "Otra línea", "link"],
    ]);
    expect(back.skipped).toBe(0);
  });
});

describe("importar", () => {
  it("lee enlaces sueltos con o sin «Artista - Título», y cuenta lo que no sirve", () => {
    const result = parsePlaylistText([
      "\uFEFFhttps://youtu.be/dQw4w9WgXcQ",
      "Morat - Cómo te atreves | https://open.spotify.com/track/" + TRACK + "?si=x",
      "https://youtu.be/dQw4w9WgXcQ?t=3",
      "C:\\Música\\cancion.mp3",
      "",
      "# comentario",
      "1. Camilo - Vida de rico (https://www.youtube.com/watch?v=abcdefghijk).",
    ].join("\r\n"));
    expect(result.songs).toEqual([
      { artist: "", title: "", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", source: "youtube" },
      { artist: "Morat", title: "Cómo te atreves", url: `https://open.spotify.com/track/${TRACK}`, source: "spotify" },
      { artist: "Camilo", title: "Vida de rico", url: "https://www.youtube.com/watch?v=abcdefghijk", source: "youtube" },
    ]);
    expect(result.skipped).toBe(1);
  });

  it("no importa más del máximo", () => {
    const lines = Array.from({ length: 5 }, (_, i) => `https://example.com/cancion-${i}`).join("\n");
    expect(parsePlaylistText(lines, 3)).toMatchObject({ skipped: 2 });
    expect(parsePlaylistText(lines, 3).songs).toHaveLength(3);
  });

  it("separa artista y título", () => {
    expect(splitLabel("Ed Sheeran – Perfect")).toEqual({ artist: "Ed Sheeran", title: "Perfect" });
    expect(splitLabel("Perfect")).toEqual({ artist: "", title: "Perfect" });
    expect(splitLabel("Juanes - La camisa negra (en vivo)")).toEqual({ artist: "Juanes", title: "La camisa negra (en vivo)" });
    expect(songFromFileName("Karol_G - Provenza.mp3")).toEqual({ artist: "Karol G", title: "Provenza" });
  });
});

describe("archivos de audio", () => {
  it("acepta los formatos comunes por tipo o por extensión", () => {
    expect(audioExtension({ name: "a.bin", type: "audio/mpeg" })).toBe("mp3");
    expect(audioExtension({ name: "nota de voz.m4a", type: "" })).toBe("m4a");
    expect(audioExtension({ name: "x.oga", type: "" })).toBe("ogg");
    expect(audioExtension({ name: "foto.jpg", type: "image/jpeg" })).toBeNull();
    expect(audioExtension({ name: "virus.exe", type: "" })).toBeNull();
  });
});

describe("dedicatorias", () => {
  const items = [
    withSongs(dedication("para-cami", "2026-01-02"), []),
    withSongs(dedication("de-cami", "2026-03-01", undefined, { authorId: "cami", recipientId: "juan" }), []),
    withSongs(dedication("para-todos", "2026-03-01", "2026-03-01T10:00:00Z", { authorId: "juan", recipientId: null }), []),
  ];

  it("las más recientes primero", () => {
    expect(sortDedications(items).map((i) => i.dedication.id)).toEqual(["para-todos", "de-cami", "para-cami"]);
  });

  it("recibidas, enviadas o todas", () => {
    expect(filterDedications(items, "received", "cami").map((i) => i.dedication.id)).toEqual(["para-cami", "para-todos"]);
    expect(filterDedications(items, "sent", "cami").map((i) => i.dedication.id)).toEqual(["de-cami"]);
    expect(filterDedications(items, "all", "cami")).toHaveLength(3);
  });

  it("la ve quien la escribió, a quien va dirigida o todos si es para todos", () => {
    expect(canSeeDedication({ authorId: "juan", recipientId: "cami" }, "valen")).toBe(false);
    expect(canSeeDedication({ authorId: "juan", recipientId: "cami" }, "cami")).toBe(true);
    expect(canSeeDedication({ authorId: "juan", recipientId: null }, "valen")).toBe(true);
  });
});
