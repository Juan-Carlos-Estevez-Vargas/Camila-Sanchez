/**
 * Preferencias de cookies y almacenamiento.
 *
 * La app no usa cookies de seguimiento ni publicidad. Lo único opcional es
 * cargar las tipografías desde Google Fonts: el navegador se conecta a
 * servidores de Google, que ven la dirección IP. Hasta que la persona elige,
 * no se carga nada externo y se usan las fuentes del sistema.
 *
 * La elección se guarda sólo en este navegador (es almacenamiento necesario:
 * sin él habría que preguntar en cada visita) y se puede cambiar desde el pie
 * de página.
 */
import { useSyncExternalStore } from "react";

const KEY = "consent:cookies";
/** Si cambian las categorías, se sube la versión y se vuelve a preguntar. */
export const COOKIE_CONSENT_VERSION = 1;

export interface CookieChoice {
  version: number;
  /** Tipografías de Google Fonts (servicio de terceros). */
  externalFonts: boolean;
  decidedAt: string;
}

const listeners = new Set<() => void>();
let bannerOpen = false;

function read(): CookieChoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CookieChoice>;
    if (value.version !== COOKIE_CONSENT_VERSION || typeof value.externalFonts !== "boolean") return null;
    return { version: value.version, externalFonts: value.externalFonts, decidedAt: String(value.decidedAt ?? "") };
  } catch {
    return null;
  }
}

let choice: CookieChoice | null = typeof window === "undefined" ? null : read();

const emit = () => listeners.forEach((listener) => listener());

export function getCookieChoice(): CookieChoice | null {
  return choice;
}

/** Guarda la elección. Ambas opciones pesan lo mismo: no hay una «buena». */
export function setCookieChoice(externalFonts: boolean): void {
  choice = { version: COOKIE_CONSENT_VERSION, externalFonts, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Almacenamiento bloqueado: la elección dura hasta recargar.
  }
  bannerOpen = false;
  emit();
}

/** Vuelve a abrir el aviso (enlace «Preferencias de cookies» del pie). */
export function openCookiePreferences(): void {
  bannerOpen = true;
  emit();
}

export function closeCookiePreferences(): void {
  bannerOpen = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCookieChoice(): CookieChoice | null {
  return useSyncExternalStore(subscribe, getCookieChoice, () => null);
}

/** El aviso se muestra si aún no hay elección o si la persona lo abrió. */
export function useCookieBannerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => bannerOpen || choice === null, () => false);
}

