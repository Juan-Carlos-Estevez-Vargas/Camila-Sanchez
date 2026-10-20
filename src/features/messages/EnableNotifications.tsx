import { useState } from "react";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import {
  enableNotifications, needsHomeScreenInstall, notificationPermission, syncPushSubscription,
} from "@/services/notifications/browserNotifications";

/** En iPhone los avisos sólo existen con la app en la pantalla de inicio. */
function InstallHint() {
  return (
    <span>
      📲 Para recibir avisos en el iPhone, toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>,
      abre la app desde ese ícono y activa los avisos ahí.
    </span>
  );
}

/** Banner para activar los avisos en el celular (cajita y chat). */
export function EnableNotifications() {
  const backend = useBackend();
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermission);
  if (needsHomeScreenInstall() && permission !== "granted") {
    return <div className="card notify-cta" data-tour="push"><InstallHint /></div>;
  }
  if (permission === "unsupported" || permission === "granted") return null;
  return (
    <div className="card row-between notify-cta" data-tour="push">
      <span>🔔 Activa los avisos para que te lleguen al celular cuando te escriban.</span>
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

/** Tarjeta de Mi cuenta: estado de los avisos en este dispositivo y prueba. */
export function DeviceNotificationsCard() {
  const backend = useBackend();
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermission);
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    try {
      const result = await enableNotifications(backend.push);
      setPermission(result);
      if (result === "granted") toast.success("¡Listo! Los avisos llegarán a este dispositivo 💌");
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const push = await syncPushSubscription(backend.push);
      await backend.messaging.sendTestNotification();
      toast.success(
        "Aviso de prueba enviado",
        push ? "Bloquea el celular o sal de la app: debería aparecer en unos segundos." : "Llegará aquí en la campana; los avisos al celular aún no están configurados en el servidor.",
      );
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  let content;
  if (needsHomeScreenInstall() && permission !== "granted") {
    content = <p className="muted" style={{ margin: 0 }}><InstallHint /></p>;
  } else if (permission === "unsupported") {
    content = <p className="muted" style={{ margin: 0 }}>Este navegador no permite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizado.</p>;
  } else if (permission === "denied") {
    content = (
      <p className="muted" style={{ margin: 0 }}>
        Los avisos están bloqueados para esta página. Actívalos en los ajustes del navegador
        (el candado junto a la dirección → Notificaciones → Permitir) y vuelve aquí.
      </p>
    );
  } else if (permission === "default") {
    content = (
      <div className="row-between">
        <p className="muted" style={{ margin: 0 }}>Recibe en este dispositivo los mensajes del chat, las notitas y las sorpresas, aunque la app esté cerrada.</p>
        <button className="btn" disabled={busy} onClick={() => void activate()}>Activar avisos</button>
      </div>
    );
  } else {
    content = (
      <div className="row-between">
        <p style={{ margin: 0 }}>✅ Activados en este dispositivo.</p>
        <button className="btn btn--soft" disabled={busy} onClick={() => void test()}>Enviar aviso de prueba</button>
      </div>
    );
  }

  return (
    <section className="card stack" style={{ marginTop: 16 }} data-tour="account-push">
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Avisos en este dispositivo 🔔</h2>
      {content}
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Actívalos en cada celular o computador donde quieras recibirlos. Al cerrar sesión, ese dispositivo deja de recibirlos.
      </p>
    </section>
  );
}
