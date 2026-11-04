/**
 * Instalar la app en el celular o el computador.
 *
 * Chrome, Edge y Samsung Internet (Android y computador) avisan con
 * `beforeinstallprompt` que la app se puede instalar: se guarda ese evento
 * para abrir el diálogo del sistema cuando la persona toca "Instalar". El
 * evento llega muy pronto, por eso `listenForInstallPrompt` se llama en
 * main.tsx antes de pintar React. En iPhone no existe ese diálogo: se
 * instala desde Compartir → "Agregar a inicio" (la página lo explica).
 */
import { useSyncExternalStore } from "react";
import { detectPlatform, isIosSafari, isStandalone, type InstallPlatform } from "./platform";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallState {
  platform: InstallPlatform;
  /** Abierta desde el ícono (ya instalada en este dispositivo). */
  installed: boolean;
  /** El navegador ofrece su diálogo de instalación (un toque). */
  canPrompt: boolean;
  /** iPhone con Safari: el botón Compartir está abajo; en otros, arriba. */
  iosSafari: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
let snapshot: InstallState | null = null;

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

export function getInstallState(): InstallState {
  snapshot ??= {
    platform: detectPlatform(),
    installed: justInstalled || isStandalone(),
    canPrompt: deferred !== null,
    iosSafari: isIosSafari(),
  };
  return snapshot;
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallState, getInstallState);
}

/** Se llama una vez al arrancar. */
export function listenForInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Sin esto Chrome muestra su propia barra; la app ofrece su botón.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    emit();
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", emit);
}

/** Abre el diálogo de instalación del sistema. Devuelve si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  // Cada evento sirve una sola vez.
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") {
    justInstalled = true;
    emit();
  }
  return outcome === "accepted";
}

const DISMISS_KEY = "install-banner-dismissed";
const DISMISS_DAYS = 21;

/** El aviso "Instala la app" se esconde unas semanas si la persona lo cierra. */
export function installBannerDismissed(now = Date.now()): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return until > now;
  } catch {
    return false;
  }
}

export function dismissInstallBanner(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now + DISMISS_DAYS * 86_400_000));
  } catch {
    // Sin almacenamiento (modo privado): vuelve a salir la próxima vez.
  }
}
