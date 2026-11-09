/**
 * Pedido de tutorial desde fuera del botón «?»: las novedades llevan a una
 * página y piden que, al llegar, empiece el recorrido de esa función.
 */
import { useSyncExternalStore } from "react";

export interface TourRequest {
  /** Página donde debe empezar. */
  path: string;
  /** Presentación de la función (primer paso). */
  intro: { title: string; body: string };
}

let pending: TourRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const get = () => pending;

export function requestTour(request: TourRequest): void {
  pending = request;
  emit();
}

export function clearTourRequest(): void {
  if (!pending) return;
  pending = null;
  emit();
}

export function useTourRequest(): TourRequest | null {
  return useSyncExternalStore(subscribe, get, get);
}
