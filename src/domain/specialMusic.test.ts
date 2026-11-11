import { describe, expect, it } from "vitest";
import { normalizeSpecialDays, SPECIAL_DAY_IDS } from "./specialDays";
import {
  musicDayKey, normalizeDaySongs, parseMusicLink, parseSongLines, SPECIAL_TUNES, tuneBeats, tuneSchedule,
} from "./specialMusic";

describe("parseMusicLink", () => {
  it("acepta YouTube (video o lista) en su forma canónica", () => {
    expect(parseMusicLink("https://youtu.be/dQw4w9WgXcQ?si=abc")).toMatchObject({ kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(parseMusicLink("https://www.youtube.com/playlist?list=PLabcdefghij")?.kind).toBe("youtube");
  });

  it("acepta archivos de audio por https", () => {
    expect(parseMusicLink("https://ejemplo.com/musica/serenata.mp3")).toEqual({ kind: "audio", url: "https://ejemplo.com/musica/serenata.mp3" });
    expect(parseMusicLink("https://x.supabase.co/storage/v1/object/public/a/cancion.M4A?token=1")?.kind).toBe("audio");
  });

  it("rechaza Spotify, páginas sueltas y http", () => {
    expect(parseMusicLink("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
    expect(parseMusicLink("https://ejemplo.com/pagina")).toBeNull();
    expect(parseMusicLink("http://ejemplo.com/a.mp3")).toBeNull();
    expect(parseMusicLink("javascript:alert(1)")).toBeNull();
  });
});

describe("canciones de cada fecha", () => {
  it("guarda sólo lo que sirve, sin repetir y con tope", () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://e.com/${i}.mp3`);
    const songs = normalizeDaySongs({
      birthday: ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "nada", 3],
      halloween: many,
      christmas: "no es lista",
      inventada: ["https://e.com/a.mp3"],
    }, SPECIAL_DAY_IDS);
    expect(songs.birthday).toEqual(["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]);
    expect(songs.halloween).toHaveLength(20);
    expect(songs).not.toHaveProperty("christmas");
    expect(songs).not.toHaveProperty("inventada");
  });

  it("la música viene prendida y se puede apagar", () => {
    expect(normalizeSpecialDays({}).music).toBe(true);
    expect(normalizeSpecialDays({ music: false }).music).toBe(false);
  });

  it("el cuadro del panel separa los enlaces buenos de los malos", () => {
    expect(parseSongLines("https://youtu.be/dQw4w9WgXcQ\n\n  hola \nhttps://e.com/a.ogg\n"))
      .toEqual({ urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://e.com/a.ogg"], invalid: ["hola"] });
  });
});

describe("musicDayKey", () => {
  it("vale sólo ese día (o la vista previa)", () => {
    expect(musicDayKey("halloween", new Date(2026, 9, 31, 23), false)).toBe("halloween:2026-10-31");
    expect(musicDayKey("christmas", new Date(2026, 11, 24), true)).toBe("christmas:vista-previa");
  });
});

describe("melodías", () => {
  it("cada fecha tiene la suya, con melodía y acompañamiento del mismo largo", () => {
    for (const id of SPECIAL_DAY_IDS) {
      const tune = SPECIAL_TUNES[id];
      expect(tune.melody.length, id).toBeGreaterThan(8);
      expect(tuneBeats(tune.chords), id).toBe(tuneBeats(tune.melody));
    }
  });

  it("se programan en orden y dentro de la vuelta", () => {
    for (const id of SPECIAL_DAY_IDS) {
      const { length, notes } = tuneSchedule(SPECIAL_TUNES[id]);
      expect(notes.every((n, i) => i === 0 || n.at >= notes[i - 1]!.at)).toBe(true);
      expect(notes.every((n) => n.at < length && n.freq > 30 && n.freq < 2000 && n.dur > 0)).toBe(true);
      // Ni muy cortas ni eternas: de 10 segundos a un minuto y medio por vuelta.
      expect(length).toBeGreaterThan(10);
      expect(length).toBeLessThan(90);
    }
  });
});
