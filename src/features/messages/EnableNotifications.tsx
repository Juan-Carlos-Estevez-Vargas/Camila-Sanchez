import { useState } from "react";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { enableNotifications, notificationPermission } from "@/services/notifications/browserNotifications";

/** Botón para activar avisos del sistema (y push si está configurado). */
export function EnableNotifications() {
  const backend = useBackend();
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermission);
  if (permission === "unsupported" || permission === "granted") return null;
  return (
    <div className="card row-between notify-cta" data-tour="push">
      <span>🔔 Activa los avisos para enterarte al instante cuando te escriban.</span>
      <button
        className="btn btn--sm"
        disabled={permission === "denied"}
        onClick={async () => {
          try {
            const result = await enableNotifications(backend.push);
            setPermission(result);
            if (result === "granted") toast.success("¡Listo! Te avisaré cuando llegue algo 💌");
          } catch (error) {
            toast.error(error);
          }
        }}
      >
        {permission === "denied" ? "Bloqueados en el navegador" : "Activar avisos"}
      </button>
    </div>
  );
}
