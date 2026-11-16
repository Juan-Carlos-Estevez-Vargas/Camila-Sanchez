/**
 * Una carta en tarjetas a pantalla completa. Sirve para las dos cartas:
 *
 *   «Para ti» (/para-ti): portada → 6 tarjetas «No quiero perderte…» → «Te amo»
 *   «Hasta siempre» (/despedida): portada → 9 tarjetas → «Sé feliz, Cami.»
 *
 * Las tarjetas alternan terracota y crema con letra a mano (Caveat Brush,
 * servida desde el propio sitio: no sale nada hacia Google). Se pasan
 * tocando a la derecha/izquierda, deslizando o con las flechas del teclado.
 *
 * El toque de «Ábrelo» es el que deja sonar la canción de cada carta:
 * un video de YouTube sin cookies en una tarjetita abajo, con su botón para
 * pausar. Al sonar, se pausa cualquier otra música de la app (audioFocus).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { markForYouOpened } from "@/domain/forYouSeen";
import { cardTone, INTRO_STEP, LETTERS, moveStep, type LetterId } from "@/domain/forYou";
import { embedUrl, EMBED_ORIGINS, parseSongLink } from "@/domain/songs";
import { useT } from "@/i18n";
import { claimAudio, onAudioClaimed } from "@/services/audio/audioFocus";
import styles from "./ForYouPage.module.scss";

const SWIPE = 40;

/** Lee el estado del video (1 = sonando, 2 = en pausa) de los mensajes de YouTube. */
function playerState(raw: unknown): number | undefined {
  let data: { event?: string; info?: unknown };
  try {
    data = (typeof raw === "string" ? JSON.parse(raw) : raw) as typeof data;
  } catch {
    return undefined;
  }
  const info = data?.info as { playerState?: number } | number | null | undefined;
  if (data?.event === "onStateChange" && typeof info === "number") return info;
  if (data?.event === "infoDelivery" && info && typeof info === "object") return info.playerState;
  return undefined;
}

/**
 * La canción. Si el celular no deja que arranque sola (iPhone), el video se ve
 * en la tarjetita y basta con tocarlo; el botón sigue lo que de verdad pasa.
 */
function Song({ letter, playing, onToggle, onState }: { letter: LetterId; playing: boolean; onToggle(): void; onState(playing: boolean): void }) {
  const t = useT()[letter];
  const song = LETTERS[letter].song;
  const frame = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => {
    const link = parseSongLink(song);
    const url = link && embedUrl(link, window.location.origin);
    // En bucle: la canción sigue mientras ella lee.
    return url && link && link.source === "youtube" ? `${url}&loop=1&playlist=${link.id}` : null;
  }, [song]);

  const send = useCallback((data: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ id: 1, channel: "widget", ...data }), EMBED_ORIGINS.youtube);
  }, []);

  useEffect(() => {
    send({ event: "command", func: playing ? "playVideo" : "pauseVideo", args: [] });
  }, [playing, send]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGINS.youtube || event.source !== frame.current?.contentWindow) return;
      const state = playerState(event.data);
      if (state === 1) onState(true);
      else if (state === 2) onState(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onState]);

  if (!src) return null;
  return (
    <div className={styles.song}>
      <iframe ref={frame} className={styles.songFrame} src={src} title={t.songFrame}
        onLoad={() => send({ event: "listening" })}
        allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
      <span className={styles.songName}>♪ {t.song}</span>
      <button type="button" className={styles.songButton} onClick={onToggle} aria-label={playing ? t.pause : t.play}>
        {playing ? "❚❚" : "▶"}
      </button>
    </div>
  );
}

export default function ForYouPage({ letter = "forYou" }: { letter?: LetterId }) {
  const t = useT()[letter];
  const { doneTo, long } = LETTERS[letter];
  const phrases = t.cards.length;
  const [step, setStep] = useState(INTRO_STEP);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const go = useCallback((delta: number) => setStep((s) => moveStep(s, delta, phrases)), [phrases]);

  const open = () => {
    // Ya la abrió: la tarjeta del inicio deja de salir en este navegador.
    markForYouOpened(letter);
    setStarted(true);
    setPlaying(true);
    claimAudio("letter");
    go(1);
  };

  // Si empieza otra música (la playlist, la portada), la canción se pausa.
  useEffect(() => onAudioClaimed("letter", () => setPlaying(false)), []);

  const onSongState = useCallback((now: boolean) => {
    if (now) claimAudio("letter");
    setPlaying(now);
  }, []);

  const toggleSong = () => {
    if (!playing) claimAudio("letter");
    setPlaying((p) => !p);
  };

  // Pantalla completa: la página de atrás no se desplaza.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (step === INTRO_STEP) return;
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  // Cada tarjeta nueva recibe el foco: el lector de pantalla la lee entera.
  useEffect(() => {
    if (step !== INTRO_STEP) card.current?.focus({ preventScroll: true });
  }, [step]);

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from || step === INTRO_STEP || step === phrases) return;
    const dx = e.clientX - from.x;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(e.clientY - from.y)) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    // Un toque: a la derecha sigue, a la izquierda vuelve (como un carrusel).
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left > box.width / 3 ? 1 : -1);
  };

  const isFinal = step === phrases;
  const tone = step === INTRO_STEP ? "cream" : isFinal ? "warm" : cardTone(step);

  return (
    <main id="contenido-principal" className={`${styles.letter} ${styles[tone]}${long ? ` ${styles.long}` : ""}`}>
      <Link to="/" className={styles.close} aria-label={t.close}>×</Link>
      {step !== INTRO_STEP && (
        <p className={styles.counter} aria-hidden>{t.counter(Math.min(step + 1, phrases), phrases)}</p>
      )}

      {step === INTRO_STEP ? (
        <div className={styles.intro}>
          <p className={styles.heart} aria-hidden>♥</p>
          <h1 className={styles.hand}>{t.intro.to}</h1>
          <p className={styles.hint}>{t.intro.hint}</p>
          <button type="button" className={styles.open} onClick={open}>{t.intro.open}</button>
        </div>
      ) : (
        <div ref={card} key={step} tabIndex={-1} className={styles.card} aria-live="polite"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {isFinal ? (
            <div className={styles.final}>
              <h1 className={`${styles.hand} ${styles.phrase}`}>{t.final.title}</h1>
              <p className={styles.message}>{t.final.message}</p>
              <p className={`${styles.hand} ${styles.signature}`}>{t.final.signature}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={() => setStep(0)}>{t.final.again}</button>
                <Link to={doneTo} className={styles.open}>{t.final.write}</Link>
              </div>
            </div>
          ) : (
            <p className={`${styles.hand} ${styles.phrase}`}>{t.cards[step]}</p>
          )}
        </div>
      )}

      {step !== INTRO_STEP && !isFinal && (
        <nav className={styles.nav} aria-label={t.pageTitle}>
          <button type="button" className={styles.arrow} onClick={() => go(-1)} disabled={step === 0} aria-label={t.previous}>‹</button>
          <ol className={styles.dots} aria-hidden>
            {Array.from({ length: phrases + 1 }, (_, i) => <li key={i} className={i === step ? styles.dotOn : undefined} />)}
          </ol>
          <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label={t.next}>›</button>
        </nav>
      )}
      {step === 0 && <p className={styles.swipe}>{t.swipe}</p>}

      {started && <Song letter={letter} playing={playing} onToggle={toggleSong} onState={onSongState} />}
    </main>
  );
}
