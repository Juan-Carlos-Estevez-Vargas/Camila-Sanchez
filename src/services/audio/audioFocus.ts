/**
 * Un solo sonido a la vez: la música de fondo de la página y el reproductor
 * de la playlist se avisan por aquí. Cuando uno empieza, el otro se pausa.
 */
import { EventBus } from "@/core/events";

export type AudioOwner = "background" | "playlist";

const bus = new EventBus<{ claim: AudioOwner }>();

/** Avisa que `owner` empieza a sonar. */
export function claimAudio(owner: AudioOwner): void {
  bus.emit("claim", owner);
}

/** Llama a `pause` cuando otro empieza a sonar. Devuelve cómo dejar de escuchar. */
export function onAudioClaimed(owner: AudioOwner, pause: () => void): () => void {
  return bus.on("claim", (who) => {
    if (who !== owner) pause();
  });
}
