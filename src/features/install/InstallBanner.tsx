import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { INSTALL_PATH } from "@/core/seo";
import { dismissInstallBanner, installBannerDismissed, useInstallState } from "@/services/pwa/install";
import { useCookieBannerOpen } from "@/services/consent/cookieConsent";
import { useT } from "@/i18n";
import { InstallButton } from "./InstallButton";

/** Rutas donde el aviso estorbaría (el chat ocupa la pantalla; /app ya lo explica). */
const HIDDEN = [INSTALL_PATH, "/chat", "/entrar", "/invitacion", "/recuperar"];
const DELAY_MS = 4000;

/**
 * Aviso pequeño abajo, sólo en el celular y si la app no está instalada:
 * "Instala la app". Sale unos segundos después de entrar, nunca junto al
 * aviso de cookies, y si se cierra no vuelve en unas semanas.
 */
export function InstallBanner() {
  const t = useT().install.banner;
  const state = useInstallState();
  const { pathname } = useLocation();
  const cookieOpen = useCookieBannerOpen();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(installBannerDismissed);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const hidden = HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!ready || dismissed || cookieOpen || hidden || state.installed || state.platform === "desktop") return null;

  return (
    <aside className="install-banner" aria-label={t.text}>
      <img src="/icons/icon-192.png" alt="" width={40} height={40} />
      <span className="install-banner__text">{t.text}</span>
      {state.canPrompt
        ? <InstallButton className="btn btn--sm" label={t.install} />
        : <Link className="btn btn--sm" to={INSTALL_PATH}>{t.how}</Link>}
      <button type="button" className="install-banner__close" aria-label={t.close}
        onClick={() => { dismissInstallBanner(); setDismissed(true); }}>×</button>
    </aside>
  );
}
