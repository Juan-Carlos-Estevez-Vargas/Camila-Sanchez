/**
 * Si la carta «Para ti» ya se abrió en este navegador. La tarjeta del inicio
 * («Tengo algo para ti 💌») sale hasta que se abra; «Luego» la esconde sólo
 * hasta la próxima visita.
 */
const SEEN_KEY = "for-you-seen";
const LATER_KEY = "for-you-later";

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function wasForYouOpened(): boolean {
  return safe(() => localStorage.getItem(SEEN_KEY) === "1", false);
}

export function markForYouOpened(): void {
  safe(() => localStorage.setItem(SEEN_KEY, "1"), undefined);
}

export function wasForYouPostponed(): boolean {
  return safe(() => sessionStorage.getItem(LATER_KEY) === "1", false);
}

export function postponeForYou(): void {
  safe(() => sessionStorage.setItem(LATER_KEY, "1"), undefined);
}
