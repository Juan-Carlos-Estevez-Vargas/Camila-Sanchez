/**
 * Qué versión de las novedades ya vio cada persona (en este navegador) y el
 * pedido de abrirlas a mano (desde el pie de página).
 */
import { useSyncExternalStore } from "react";

const key = (userId: string) => `whatsNew:seen:${userId}`;

export function readSeenRelease(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function markReleaseSeen(userId: string, release: string | null): void {
  if (!release) return;
  try {
    localStorage.setItem(key(userId), release);
  } catch {
    // Almacenamiento bloqueado (modo privado): se vuelven a mostrar la próxima vez.
  }
}

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const get = () => open;

/** Abre la historia completa de novedades. */
export function openWhatsNew(): void {
  open = true;
  emit();
}

export function closeWhatsNew(): void {
  if (!open) return;
  open = false;
  emit();
}

export function useWhatsNewOpen(): boolean {
  return useSyncExternalStore(subscribe, get, get);
}
