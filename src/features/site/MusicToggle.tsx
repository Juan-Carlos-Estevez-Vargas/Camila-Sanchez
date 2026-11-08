import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { claimAudio, onAudioClaimed } from "@/services/audio/audioFocus";

/** Música de fondo opcional: nunca suena sola, sólo si la persona la activa. */
export function MusicToggle({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const t = useT().site;

  useEffect(() => () => audio.current?.pause(), []);
  // Si empieza a sonar la playlist, la música de fondo se pausa.
  useEffect(() => onAudioClaimed("background", () => {
    audio.current?.pause();
    setPlaying(false);
  }), []);

  const toggle = async () => {
    audio.current ??= Object.assign(new Audio(url), { loop: true, volume: 0.5 });
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      try {
        await audio.current.play();
        claimAudio("background");
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  return (
    <button className="music-toggle btn btn--icon" data-tour="music" onClick={toggle} aria-pressed={playing} aria-label={t.music} title={playing ? t.pauseMusic : t.playMusic}>
      <span aria-hidden>{playing ? "❚❚" : "♪"}</span>
    </button>
  );
}
