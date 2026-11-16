/**
 * Si una carta («Para ti», «Hasta siempre») ya se abrió en este navegador. La
 * tarjeta del inicio sale hasta que se abra; «Luego» la esconde sólo hasta la
 * próxima visita. Cada carta lleva sus propias claves.
 */
import type { LetterId } from "./forYou";

const KEYS: Record<LetterId, { seen: string; later: string }> = {
  forYou: { seen: "for-you-seen", later: "for-you-later" },
  goodbye: { seen: "goodbye-seen", later: "goodbye-later" },
};

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function wasForYouOpened(letter: LetterId = "forYou"): boolean {
  return safe(() => localStorage.getItem(KEYS[letter].seen) === "1", false);
}

export function markForYouOpened(letter: LetterId = "forYou"): void {
  safe(() => localStorage.setItem(KEYS[letter].seen, "1"), undefined);
}

export function wasForYouPostponed(letter: LetterId = "forYou"): boolean {
  return safe(() => sessionStorage.getItem(KEYS[letter].later) === "1", false);
}

export function postponeForYou(letter: LetterId = "forYou"): void {
  safe(() => sessionStorage.setItem(KEYS[letter].later, "1"), undefined);
}
