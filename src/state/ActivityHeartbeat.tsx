import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  ACTIVITY_HEARTBEAT_MS, SESSION_GAP_MS, normalizePath, parseDevice, sectionOf,
} from "@/domain/activity";
import type { ActivityDevice } from "@/domain/types";
import { isStandalone } from "@/services/pwa/platform";
import { useAuth } from "./AuthContext";
import { useBackend } from "./BackendContext";

const SESSION_ID_KEY = "love-activity-session";
const SESSION_SEEN_KEY = "love-activity-seen";

/**
 * Seguimiento de actividad para el administrador: mientras alguien tiene la
 * app abierta y a la vista, avisa cada ~30 s de la página en la que está y
 * cuántos segundos lleva. Así, en Auditoría → Actividad, el super admin ve
 * cuándo entra cada persona, qué mira, cuánto tiempo y desde qué dispositivo.
 *
 * No se registra el contenido de los mensajes ni lo que se escribe; el chat se
 * guarda sólo como "/chat" y las rutas van sin identificadores. A nadie se le
 * muestra ningún aviso: el seguimiento es silencioso.
 */
export function ActivityHeartbeat() {
  const backend = useBackend();
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Lo que cambia en cada render se lee por ref dentro del temporizador.
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const viewIdRef = useRef<string>("");
  const lastBeatRef = useRef<number>(Date.now());

  // Visita: un id que dura mientras se siga usando la app sin un hueco largo.
  const sessionId = useRef<string>("");
  function currentSession(): string {
    const now = Date.now();
    const read = (k: string) => {
      try { return sessionStorage.getItem(k); } catch { return null; }
    };
    const write = (k: string, v: string) => {
      try { sessionStorage.setItem(k, v); } catch { /* modo privado */ }
    };
    const lastSeen = Number(read(SESSION_SEEN_KEY) ?? 0);
    let id = read(SESSION_ID_KEY);
    if (!id || !lastSeen || now - lastSeen > SESSION_GAP_MS) {
      id = crypto.randomUUID();
      write(SESSION_ID_KEY, id);
    }
    write(SESSION_SEEN_KEY, String(now));
    return id;
  }

  const device = useRef<ActivityDevice | undefined>(undefined);
  if (!device.current && typeof navigator !== "undefined") {
    device.current = parseDevice(navigator.userAgent, {
      touchPoints: navigator.maxTouchPoints,
      installed: isStandalone(),
    });
  }

  useEffect(() => {
    if (!user) return;

    const send = (newView: boolean) => {
      const now = Date.now();
      const visible = typeof document === "undefined" || document.visibilityState === "visible";
      // Segundos a la vista desde el último latido (0 si estuvo en segundo plano).
      const delta = visible ? Math.min(Math.round((now - lastBeatRef.current) / 1000), 120) : 0;
      lastBeatRef.current = now;
      if (newView || !viewIdRef.current) viewIdRef.current = crypto.randomUUID();
      sessionId.current = currentSession();
      void backend.activity.track({
        sessionId: sessionId.current,
        viewId: viewIdRef.current,
        device: device.current ?? { kind: "computer", os: "Otro", browser: "Otro", installed: false },
        path: normalizePath(pathRef.current),
        section: sectionOf(pathRef.current),
        deltaSeconds: delta,
      }).catch(() => undefined);
    };

    // Primer latido de esta página (nueva vista).
    lastBeatRef.current = Date.now();
    send(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send(false);
    }, ACTIVITY_HEARTBEAT_MS);

    const onVisibility = () => {
      // Al ocultarse, guarda el tiempo acumulado; al volver, reinicia el reloj.
      if (document.visibilityState === "hidden") send(false);
      else lastBeatRef.current = Date.now();
    };
    const onLeave = () => send(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      send(false); // cierra el tiempo de esta página antes de cambiar de ruta
    };
    // Una nueva ruta reinicia el efecto: cierra la página anterior y abre la nueva.
  }, [backend, user, pathname]);

  return null;
}
