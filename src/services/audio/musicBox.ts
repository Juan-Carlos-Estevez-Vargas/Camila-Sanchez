/**
 * Cajita musical con Web Audio: toca en bucle una melodía de
 * domain/specialMusic.ts, bajito, sin descargar ningún archivo.
 *
 * Cada nota es un tono con un golpe corto y una cola que se apaga (como una
 * cajita o una campanita), con un eco suave para que no suene seco. Las
 * notas se programan medio segundo por delante con el reloj del audio, así
 * no se atrasan aunque la página esté ocupada.
 *
 * Los navegadores sólo dejan sonar audio después de que la persona toca la
 * página: `start()` hay que llamarlo dentro de ese toque (o después).
 */
import { tuneSchedule, type Tune, type TuneVoice } from "@/domain/specialMusic";

/** Volumen general: música de fondo, que no tape nada. */
const VOLUME = 0.16;
const LOOKAHEAD = 0.6;
const TICK_MS = 200;

type AudioContextCtor = typeof AudioContext;

const VOICES: Record<TuneVoice, { wave: OscillatorType; partials: [ratio: number, gain: number][]; decay: number }> = {
  box: { wave: "sine", partials: [[1, 1], [2, 0.25], [3, 0.08]], decay: 1.4 },
  bells: { wave: "sine", partials: [[1, 1], [2.01, 0.35], [3.98, 0.12]], decay: 2.2 },
  spooky: { wave: "triangle", partials: [[1, 1], [1.005, 0.6], [0.5, 0.35]], decay: 1.8 },
};

export interface MusicBox {
  /** Empieza (o sigue) a sonar. Devuelve false si el navegador no lo deja. */
  start(): Promise<boolean>;
  /** Pausa con un fundido corto. */
  pause(): void;
  /** Apaga y suelta el audio del sistema. */
  dispose(): void;
}

export function createMusicBox(tune: Tune): MusicBox {
  const Ctor: AudioContextCtor | undefined =
    typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  const { length, notes } = tuneSchedule(tune);
  const voice = VOICES[tune.voice];
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  /** Hora del audio en que empezó la vuelta actual y la próxima nota por programar. */
  let loopStart = 0;
  let next = 0;

  function setup(): AudioContext | null {
    if (ctx || !Ctor) return ctx;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    // Eco suave: un retardo que se realimenta poquito.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    return ctx;
  }

  function play(at: number, freq: number, dur: number, gain: number) {
    if (!ctx || !master) return;
    const env = ctx.createGain();
    const peak = 0.3 * gain;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, 0.2) + voice.decay * (gain < 1 ? 0.6 : 1));
    env.connect(master);
    const end = at + dur + voice.decay + 0.1;
    for (const [ratio, level] of voice.partials) {
      const osc = ctx.createOscillator();
      osc.type = voice.wave;
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(end);
    }
  }

  function tick() {
    if (!ctx) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (true) {
      if (next >= notes.length) {
        loopStart += length;
        next = 0;
      }
      const note = notes[next]!;
      const at = loopStart + note.at;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.05) play(Math.max(at, ctx.currentTime), note.freq, note.dur, note.gain);
      next += 1;
    }
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    async start() {
      const audio = setup();
      if (!audio || !master || notes.length === 0) return false;
      try {
        await audio.resume();
      } catch {
        return false;
      }
      if (audio.state !== "running") return false;
      if (!timer) {
        loopStart = audio.currentTime + 0.1;
        next = 0;
        timer = setInterval(tick, TICK_MS);
        tick();
      }
      master.gain.cancelScheduledValues(audio.currentTime);
      master.gain.setValueAtTime(master.gain.value, audio.currentTime);
      master.gain.linearRampToValueAtTime(VOLUME, audio.currentTime + 1.2);
      return true;
    },
    pause() {
      stopTimer();
      if (!ctx || !master) return;
      const audio = ctx;
      master.gain.cancelScheduledValues(audio.currentTime);
      master.gain.setValueAtTime(master.gain.value, audio.currentTime);
      master.gain.linearRampToValueAtTime(0, audio.currentTime + 0.4);
      setTimeout(() => {
        if (!timer && audio.state === "running") void audio.suspend().catch(() => undefined);
      }, 500);
    },
    dispose() {
      stopTimer();
      void ctx?.close().catch(() => undefined);
      ctx = null;
      master = null;
    },
  };
}
