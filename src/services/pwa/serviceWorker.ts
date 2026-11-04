/**
 * Registro del service worker y actualizaciones de la app instalada.
 *
 * Una app instalada puede quedar abierta días. Cuando se publica una versión
 * nueva, el service worker nuevo se instala en segundo plano (ya con todo
 * descargado para funcionar sin conexión) y espera: la app muestra "Hay una
 * versión nueva" y, al tocar Actualizar, el nuevo toma el control y la
 * página se recarga. La primera instalación no espera.
 */
import { useSyncExternalStore } from "react";

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getUpdateReady = () => waiting !== null;

export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, getUpdateReady, getUpdateReady);
}

function track(registration: ServiceWorkerRegistration) {
  const offer = (worker: ServiceWorker | null) => {
    // Sólo es "actualización" si ya había una versión controlando la página.
    if (worker && navigator.serviceWorker.controller) {
      waiting = worker;
      emit();
    }
  };
  offer(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed") offer(installing);
    });
  });
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Sólo recarga si fue la persona quien pidió actualizar.
    if (reloading || !waitingRequested) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      track(registration);
      // Al volver a la app (desde otra app o el bloqueo) busca versiones nuevas.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
      });
    }).catch((error) => console.warn("[sw]", error));
  });
}

let waitingRequested = false;

/** Activa la versión nueva y recarga. */
export function applyUpdate(): void {
  if (!waiting) return;
  waitingRequested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}
