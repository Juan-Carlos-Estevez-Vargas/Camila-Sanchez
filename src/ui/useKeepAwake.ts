import { useEffect } from "react";

/**
 * Mientras `active` sea true: evita que la pantalla del teléfono se apague
 * (Screen Wake Lock) y avisa antes de cerrar la pestaña. Pensado para tandas
 * largas de fotos, que se cortarían si el teléfono se bloquea.
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock?.request("screen");
        if (disposed) void sentinel?.release();
        else lock = sentinel ?? null;
      } catch {
        // Sin soporte o batería baja: seguimos sin bloqueo.
      }
    };
    // El sistema suelta el bloqueo al cambiar de pestaña; lo pedimos de nuevo al volver.
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      disposed = true;
      void lock?.release();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
