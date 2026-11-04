import { useEffect, useState } from "react";
import { applyUpdate, useUpdateReady } from "@/services/pwa/serviceWorker";
import { useT } from "@/i18n";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Avisos de la app instalada: versión nueva lista y sin conexión. */
export function AppStatus() {
  const t = useT().install;
  const updateReady = useUpdateReady();
  const online = useOnline();
  if (!updateReady && online) return null;
  return (
    <div className="app-status" role="status">
      {!online && <p className="app-status__pill app-status__pill--offline">{t.offline}</p>}
      {updateReady && (
        <p className="app-status__pill">
          <span>{t.update.text}</span>
          <button type="button" className="btn btn--sm" onClick={applyUpdate}>{t.update.action}</button>
        </p>
      )}
    </div>
  );
}
