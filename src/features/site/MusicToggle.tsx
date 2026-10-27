import { useEffect, useRef, useState } from "react";

/** Música de fondo opcional: nunca suena sola, sólo si la persona la activa. */
export function MusicToggle({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = async () => {
    audio.current ??= Object.assign(new Audio(url), { loop: true, volume: 0.5 });
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      try {
        await audio.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  return (
    <button className="music-toggle btn btn--icon" data-tour="music" onClick={toggle} aria-pressed={playing} aria-label="Música de fondo" title={playing ? "Pausar música" : "Poner música"}>
      <span aria-hidden>{playing ? "❚❚" : "♪"}</span>
    </button>
  );
}
