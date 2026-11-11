/**
 * Música de las fechas especiales.
 *
 * Cada fecha trae una melodía suave propia, tocada en el navegador con Web
 * Audio como una cajita musical (services/audio/musicBox.ts): no hay
 * archivos de audio en el repositorio ni música de terceros. Las melodías
 * son originales o de dominio público («Cumpleaños feliz», «Noche de paz»,
 * «Auld Lang Syne»).
 *
 * Quien tiene `theme.manage` puede poner en su lugar enlaces de YouTube o de
 * archivos de audio (por ejemplo la serenata del cumpleaños). Se guardan
 * dentro de `effects.specialDays.songs`, igual que el resto de la fecha.
 *
 * Funciones puras: qué suena, cuándo y con qué notas se decide aquí.
 */
import { parseSongLink, type ParsedSongLink } from "./songs";
import type { SpecialDayId } from "./specialDays";

// --- enlaces que pone el panel ----------------------------------------------

/** Canciones como máximo por fecha. */
export const MAX_DAY_SONGS = 20;

const AUDIO_FILE = /\.(mp3|ogg|oga|opus|m4a|aac|wav|flac|webm)$/i;

/** Un enlace que sí puede sonar de fondo. */
export type MusicLink =
  | { kind: "youtube"; link: ParsedSongLink & { source: "youtube" }; url: string }
  | { kind: "audio"; url: string };

/**
 * Entiende un enlace para la música del día: un video o lista de YouTube, o
 * un archivo de audio por https (.mp3, .ogg, .m4a…). Spotify no sirve: no
 * deja sonar sola la canción ni avisa cuándo termina. null si no sirve.
 */
export function parseMusicLink(raw: string): MusicLink | null {
  const link = parseSongLink(raw);
  if (!link) return null;
  if (link.source === "youtube") return { kind: "youtube", link, url: link.url };
  if (link.source === "link") {
    const path = new URL(link.url).pathname;
    return AUDIO_FILE.test(path) ? { kind: "audio", url: link.url } : null;
  }
  return null;
}

/** Las canciones guardadas: sólo enlaces que sirven, sin repetir, en su forma canónica. */
export function normalizeDaySongs(raw: unknown, ids: readonly SpecialDayId[]): Partial<Record<SpecialDayId, string[]>> {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Partial<Record<SpecialDayId, string[]>> = {};
  for (const id of ids) {
    const list = o[id];
    if (!Array.isArray(list)) continue;
    const urls = [...new Set(list.flatMap((v) => (typeof v === "string" ? [parseMusicLink(v)?.url ?? ""] : [])).filter(Boolean))]
      .slice(0, MAX_DAY_SONGS);
    if (urls.length) out[id] = urls;
  }
  return out;
}

/** Lee el cuadro de texto del panel (un enlace por línea): los que sirven y las líneas que no. */
export function parseSongLines(text: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const parsed = parseMusicLink(line);
    if (parsed) {
      if (!urls.includes(parsed.url)) urls.push(parsed.url);
    } else {
      invalid.push(line);
    }
  }
  return { urls: urls.slice(0, MAX_DAY_SONGS), invalid };
}

/** Canciones sugeridas para la serenata del cumpleaños: se buscan en YouTube y se pega el enlace. */
export const SERENATA_SUGGESTIONS = [
  { title: "Hasta dónde te quiero", artist: "Rondalla de Roldanillo" },
  { title: "Sabes una cosa", artist: "Rondalla de Roldanillo" },
  { title: "Serenata", artist: "Rondalla de Roldanillo" },
] as const;

export const youtubeSearchUrl = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// --- quién oye la música ----------------------------------------------------

/**
 * Clave del día para recordar «apagué la música» y «ya vi el aviso»: vale
 * sólo para esa fecha y ese día, así la próxima fecha especial vuelve a sonar.
 */
export function musicDayKey(id: SpecialDayId, now: Date, preview: boolean): string {
  if (preview) return `${id}:vista-previa`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${id}:${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// --- las melodías -------------------------------------------------------------

/** Una nota: número MIDI (60 = do central) o null para un silencio, y cuántos pulsos dura. */
export type TuneNote = readonly [midi: number | null, beats: number];
/** Un acorde de acompañamiento por nombre (o null) y cuántos pulsos dura. */
export type TuneChord = readonly [chord: ChordName | null, beats: number];

/** Timbre: cajita musical, campanitas (Navidad) o pulsado grave (Halloween). */
export type TuneVoice = "box" | "bells" | "spooky";

export interface Tune {
  /** Pulsos por minuto. */
  bpm: number;
  voice: TuneVoice;
  melody: readonly TuneNote[];
  chords: readonly TuneChord[];
}

const CHORDS = {
  C: [48, 52, 55], F: [41, 45, 48], G: [43, 47, 50], Bb: [46, 50, 53], D: [38, 42, 45],
  Am: [45, 48, 52], Dm: [50, 53, 57], Em: [40, 43, 47], E: [40, 44, 47],
} as const;
export type ChordName = keyof typeof CHORDS;

export const chordNotes = (name: ChordName): readonly number[] => CHORDS[name];

// Notas (octava 4: do central = C4 = 60).
const [C4, D4, E4, F4, Fs4, G4, Gs4, A4, B4] = [60, 62, 64, 65, 66, 67, 68, 69, 71];
const [C5, D5, Ds5, E5, F5, Fs5, G5, A5, B5, C6] = [72, 74, 75, 76, 77, 78, 79, 81, 83, 84];

export const SPECIAL_TUNES: Record<SpecialDayId, Tune> = {
  // «Cumpleaños feliz» (dominio público), 3/4.
  birthday: {
    bpm: 108,
    voice: "box",
    melody: [
      [G4, 0.75], [G4, 0.25],
      [A4, 1], [G4, 1], [C5, 1],
      [B4, 2], [G4, 0.75], [G4, 0.25],
      [A4, 1], [G4, 1], [D5, 1],
      [C5, 2], [G4, 0.75], [G4, 0.25],
      [G5, 1], [E5, 1], [C5, 1],
      [B4, 1], [A4, 1], [F5, 0.75], [F5, 0.25],
      [E5, 1], [C5, 1], [D5, 1],
      [C5, 3],
    ],
    chords: [[null, 1], ["C", 3], ["G", 3], ["G", 3], ["C", 3], ["C", 3], ["F", 3], ["C", 2], ["G", 1], ["C", 3]],
  },
  // Original: vals lento en sol.
  anniversary: {
    bpm: 96,
    voice: "box",
    melody: [
      [B4, 1], [D5, 1], [G5, 1],
      [Fs5, 2], [E5, 1],
      [E5, 1], [D5, 1], [C5, 1],
      [B4, 2], [G4, 1],
      [G4, 1], [B4, 1], [E5, 1],
      [C5, 2], [A4, 1],
      [Fs4, 1], [A4, 1], [D5, 1],
      [G4, 3],
    ],
    chords: [["G", 3], ["D", 3], ["C", 3], ["G", 3], ["Em", 3], ["Am", 3], ["D", 3], ["G", 3]],
  },
  // Original: arpegios en do (I–vi–IV–V).
  valentine: {
    bpm: 84,
    voice: "box",
    melody: [
      [E5, 1], [G5, 1], [E5, 1], [D5, 1],
      [C5, 2], [A4, 2],
      [A4, 1], [C5, 1], [F5, 1], [E5, 1],
      [D5, 3], [G4, 1],
      [E5, 1], [G5, 1], [C6, 1], [B5, 1],
      [A5, 2], [E5, 2],
      [F5, 1], [E5, 1], [D5, 1], [C5, 1],
      [D5, 2], [B4, 1], [G4, 1],
      [C5, 4],
    ],
    chords: [["C", 4], ["Am", 4], ["F", 4], ["G", 4], ["C", 4], ["Am", 4], ["F", 4], ["G", 4], ["C", 4]],
  },
  // Original: alegre, pentatónica.
  friendship: {
    bpm: 112,
    voice: "box",
    melody: [
      [C5, 0.5], [D5, 0.5], [E5, 1], [G5, 1], [E5, 1],
      [A5, 1], [G5, 1], [E5, 2],
      [G5, 0.5], [E5, 0.5], [D5, 1], [C5, 1], [D5, 1],
      [E5, 2], [D5, 2],
      [C5, 0.5], [D5, 0.5], [E5, 1], [G5, 1], [A5, 1],
      [C6, 1], [A5, 1], [G5, 2],
      [E5, 1], [D5, 1], [G4, 1], [D5, 1],
      [C5, 4],
    ],
    chords: [["C", 4], ["F", 4], ["C", 4], ["G", 4], ["C", 4], ["F", 4], ["G", 4], ["C", 4]],
  },
  // Original: vals de misterio en la menor, grave y lento.
  halloween: {
    bpm: 84,
    voice: "spooky",
    melody: [
      [A4, 1], [C5, 1], [E5, 1],
      [F5, 2], [E5, 1],
      [D5, 1], [C5, 1], [B4, 1],
      [C5, 2], [A4, 1],
      [Gs4, 1], [B4, 1], [E5, 1],
      [F5, 2], [E5, 1],
      [D5, 1], [B4, 1], [Gs4, 1],
      [A4, 3],
      [E5, 1], [F5, 1], [E5, 1],
      [Ds5, 1], [E5, 1], [C5, 1],
      [B4, 1], [A4, 1], [Gs4, 1],
      [A4, 2], [E4, 1],
      [F4, 1], [A4, 1], [C5, 1],
      [B4, 2], [Gs4, 1],
      [E4, 1], [Gs4, 1], [B4, 1],
      [A4, 3],
    ],
    chords: [
      ["Am", 3], ["Dm", 3], ["E", 3], ["Am", 3], ["E", 3], ["Dm", 3], ["E", 3], ["Am", 3],
      ["Am", 3], ["E", 3], ["E", 3], ["Am", 3], ["F", 3], ["E", 3], ["E", 3], ["Am", 3],
    ],
  },
  // «Noche de paz» (Franz Gruber, 1818, dominio público), en corcheas de 6/8.
  christmas: {
    bpm: 160,
    voice: "bells",
    melody: [
      [G4, 3], [A4, 1], [G4, 2], [E4, 6],
      [G4, 3], [A4, 1], [G4, 2], [E4, 6],
      [D5, 4], [D5, 2], [B4, 6],
      [C5, 4], [C5, 2], [G4, 6],
      [A4, 4], [A4, 2], [C5, 3], [B4, 1], [A4, 2],
      [G4, 3], [A4, 1], [G4, 2], [E4, 6],
      [A4, 4], [A4, 2], [C5, 3], [B4, 1], [A4, 2],
      [G4, 3], [A4, 1], [G4, 2], [E4, 6],
      [D5, 4], [D5, 2], [F5, 3], [D5, 1], [B4, 2],
      [C5, 6], [E5, 6],
      [C5, 3], [G4, 1], [E4, 2], [G4, 3], [F4, 1], [D4, 2],
      [C4, 12],
    ],
    chords: [["C", 24], ["G", 12], ["C", 12], ["F", 12], ["C", 12], ["F", 12], ["C", 12], ["G", 12], ["C", 12], ["C", 6], ["G", 6], ["C", 12]],
  },
  // «Auld Lang Syne» (tradicional escocesa, dominio público), 4/4.
  newYear: {
    bpm: 92,
    voice: "box",
    melody: [
      [C4, 1],
      [F4, 1.5], [F4, 0.5], [F4, 1], [A4, 1],
      [G4, 1.5], [F4, 0.5], [G4, 1], [A4, 0.5], [G4, 0.5],
      [F4, 1.5], [F4, 0.5], [A4, 1], [C5, 1],
      [D5, 3], [D5, 1],
      [C5, 1.5], [A4, 0.5], [A4, 1], [F4, 1],
      [G4, 1.5], [F4, 0.5], [G4, 1], [A4, 0.5], [G4, 0.5],
      [F4, 1.5], [D4, 0.5], [D4, 1], [C4, 1],
      [F4, 3], [null, 1],
    ],
    chords: [[null, 1], ["F", 4], ["C", 4], ["F", 4], ["Bb", 4], ["F", 4], ["C", 4], ["Bb", 2], ["C", 2], ["F", 4]],
  },
};

export const tuneBeats = (parts: readonly (readonly [unknown, number])[]) => parts.reduce((sum, [, beats]) => sum + beats, 0);

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Un sonido ya ubicado en el tiempo (segundos desde que empieza la vuelta). */
export interface ScheduledNote {
  at: number;
  /** Cuánto suena antes de apagarse. */
  dur: number;
  freq: number;
  /** Volumen relativo (la melodía más fuerte que el acompañamiento). */
  gain: number;
}

/**
 * La melodía en segundos: notas de la melodía y, por cada acorde, el bajo y
 * el acorde bien suaves. `length` incluye un respiro antes de repetir.
 */
export function tuneSchedule(tune: Tune): { length: number; notes: ScheduledNote[] } {
  const beat = 60 / tune.bpm;
  const notes: ScheduledNote[] = [];
  let t = 0;
  for (const [midi, beats] of tune.melody) {
    if (midi !== null) notes.push({ at: t, dur: Math.min(beats * beat, 2.4), freq: midiToHz(midi), gain: 1 });
    t += beats * beat;
  }
  let c = 0;
  for (const [name, beats] of tune.chords) {
    if (name) {
      const [root, ...rest] = chordNotes(name);
      const dur = Math.min(beats * beat, 3.2);
      notes.push({ at: c, dur, freq: midiToHz(root! - 12), gain: 0.5 });
      for (const n of rest) notes.push({ at: c + beat * 0.5, dur: dur * 0.8, freq: midiToHz(n), gain: 0.22 });
    }
    c += beats * beat;
  }
  notes.sort((a, b) => a.at - b.at);
  return { length: Math.max(t, c) + beat * 2, notes };
}
