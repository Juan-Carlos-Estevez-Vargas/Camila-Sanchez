import { useEffect } from "react";
import { PRESENCE_HEARTBEAT_MS } from "@/domain/chat";
import { PERMISSIONS } from "@/domain/permissions";
import { useAuth } from "./AuthContext";
import { useBackend } from "./BackendContext";

/**
 * Mantiene al día la «última conexión» del chat: mientras la app está
 * abierta y visible avisa cada pocos segundos de que la persona sigue ahí.
 * Si la pestaña queda en segundo plano deja de avisar, y a los demás les
 * aparece «últ. vez hace…».
 */
export function PresenceHeartbeat() {
  const backend = useBackend();
  const { user, policy } = useAuth();
  const canChat = Boolean(user) && policy.can(PERMISSIONS.chatUse);

  useEffect(() => {
    if (!canChat) return;
    const beat = () => {
      if (document.visibilityState === "visible") void backend.messaging.touchChatPresence().catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [backend, canChat]);

  return null;
}
