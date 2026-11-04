import { useState } from "react";
import { Link } from "react-router-dom";
import { INSTALL_PATH } from "@/core/seo";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import {
  enableNotifications, needsHomeScreenInstall, notificationPermission, syncPushSubscription,
} from "@/services/notifications/browserNotifications";
import { useT } from "@/i18n";

/** En iPhone los avisos sólo existen con la app en la pantalla de inicio. */
function InstallHint() {
  const i18n = useT();
  const t = i18n.notes.push;
  const install = i18n.install;
  return (
    <span>
      {t.iphoneBefore} <strong>{t.share}</strong> → <strong>{t.addHome}</strong>{t.iphoneAfter}{" "}
      <Link to={INSTALL_PATH}>{install.account.open}</Link>
    </span>
  );
}

/** Banner para activar los avisos en el celular (cajita y chat). */
export function EnableNotifications() {
  const backend = useBackend();
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermission);
  const t = useT().notes.push;
  if (needsHomeScreenInstall() && permission !== "granted") {
    return <div className="card notify-cta" data-tour="push"><InstallHint /></div>;
  }
  if (permission === "unsupported" || permission === "granted") return null;
  return (
    <div className="card row-between notify-cta" data-tour="push">
      <span>{t.cta}</span>
      <button
        className="btn btn--sm"
        disabled={permission === "denied"}
        onClick={async () => {
          try {
            const result = await enableNotifications(backend.push);
            setPermission(result);
            if (result === "granted") toast.success(t.ready);
          } catch (error) {
            toast.error(error);
          }
        }}
      >
        {permission === "denied" ? t.blocked : t.enable}
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
  const t = useT().notes.push;

  const activate = async () => {
    setBusy(true);
    try {
      const result = await enableNotifications(backend.push);
      setPermission(result);
      if (result === "granted") toast.success(t.readyDevice);
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
        t.testSent,
        push ? t.testPush : t.testBell,
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
    content = <p className="muted" style={{ margin: 0 }}>{t.unsupported}</p>;
  } else if (permission === "denied") {
    content = (
      <p className="muted" style={{ margin: 0 }}>{t.denied}</p>
    );
  } else if (permission === "default") {
    content = (
      <div className="row-between">
        <p className="muted" style={{ margin: 0 }}>{t.offer}</p>
        <button className="btn" disabled={busy} onClick={() => void activate()}>{t.enable}</button>
      </div>
    );
  } else {
    content = (
      <div className="row-between">
        <p style={{ margin: 0 }}>{t.on}</p>
        <button className="btn btn--soft" disabled={busy} onClick={() => void test()}>{t.test}</button>
      </div>
    );
  }

  return (
    <section className="card stack" style={{ marginTop: 16 }} data-tour="account-push">
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.cardTitle}</h2>
      {content}
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{t.cardHint}</p>
    </section>
  );
}
