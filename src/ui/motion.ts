/**
 * Preferencia de movimiento. Por defecto se sigue la del sistema
 * (prefers-reduced-motion), pero cualquiera puede apagar las animaciones
 * desde el pie de página (WCAG 2.2.2 y 2.3.3). Se guarda sólo en este
 * navegador y se refleja en <html data-motion="reduce"> para el CSS.
 */
import { useSyncExternalStore } from "react";

const KEY = "a11y:motion";
const QUERY = "(prefers-reduced-motion: reduce)";
type Choice = "reduce" | "full" | null;

const listeners = new Set<() => void>();

function readChoice(): Choice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "reduce" || value === "full" ? value : null;
  } catch {
    return null;
  }
}

let choice: Choice = typeof window === "undefined" ? null : readChoice();

const systemPrefersReduced = () => typeof matchMedia !== "undefined" && matchMedia(QUERY).matches;

/** ¿Hay que evitar animaciones ahora mismo? */
export function prefersReducedMotion(): boolean {
  return choice ? choice === "reduce" : systemPrefersReduced();
}

function sync() {
  if (typeof document !== "undefined") {
    if (prefersReducedMotion()) document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  }
  listeners.forEach((listener) => listener());
}

export function setReducedMotion(reduce: boolean): void {
  choice = reduce === systemPrefersReduced() ? null : reduce ? "reduce" : "full";
  try {
    if (choice) localStorage.setItem(KEY, choice);
    else localStorage.removeItem(KEY);
  } catch {
    // Almacenamiento bloqueado: la preferencia dura hasta recargar.
  }
  sync();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  matchMedia(QUERY).addEventListener?.("change", sync);
  sync();
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
