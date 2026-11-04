import { useEffect, useState } from "react";
import { INSTALL_PATH } from "@/core/seo";
import { useInstallState } from "@/services/pwa/install";
import type { InstallPlatform } from "@/services/pwa/platform";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { Spinner } from "@/ui/Feedback";
import { useT } from "@/i18n";
import { InstallButton } from "./InstallButton";

const PLATFORMS: InstallPlatform[] = ["android", "ios", "desktop"];

/** QR con el enlace de esta página, para pasar del computador al celular. */
function PhoneQr() {
  const t = useT().install;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `${window.location.origin}${INSTALL_PATH}`;
    void import("qrcode")
      .then(({ toDataURL }) => toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#3d0a24", light: "#ffffff" } }))
      .then((dataUrl) => alive && setSrc(dataUrl));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="card install-qr">
      <div className="install-qr__code">
        {src ? <img src={src} alt={t.qrAlt} width={160} height={160} /> : <Spinner label={t.qrAlt} />}
      </div>
      <div>
        <h2>{t.qrTitle}</h2>
        <p className="muted">{t.qrText}</p>
      </div>
    </section>
  );
}

/** /app: instalar la app en el celular o el computador, paso a paso. */
export default function InstallPage() {
  const t = useT().install;
  const state = useInstallState();
  const [platform, setPlatform] = useState<InstallPlatform>(state.platform);

  const steps = platform === "ios"
    ? (state.platform === "ios" && !state.iosSafari ? t.steps.iosOther : t.steps.iosSafari)
    : platform === "android"
      ? (state.canPrompt && state.platform === "android" ? t.steps.androidPrompt : t.steps.android)
      : t.steps.desktop;

  return (
    <main id="contenido-principal" className="container install">
      <header className="install__hero">
        <img className="install__icon" src="/icons/icon-192.png" alt="" width={96} height={96} />
        <h1>{t.heroTitle}</h1>
        <p className="install__lead">{t.heroText}</p>
        {state.installed ? (
          <div className="card install__done" role="status">
            <strong>{t.installed}</strong>
            <span className="muted">{t.installedHint}</span>
          </div>
        ) : state.canPrompt ? (
          <InstallButton className="btn btn--lg" />
        ) : null}
      </header>

      {!state.installed && (
        <section className="card stack install__steps" aria-labelledby="install-steps">
          <h2 id="install-steps">{t.stepsTitle}</h2>
          <div className="tabs" role="tablist" aria-label={t.platformsLabel} onKeyDown={onRovingKeyDown}>
            {PLATFORMS.map((id) => (
              <button key={id} id={`install-tab-${id}`} role="tab" type="button" className="tab" aria-selected={platform === id}
                aria-controls="install-panel" tabIndex={rovingTabIndex(platform === id)} onClick={() => setPlatform(id)}>
                {t.platforms[id]}
                {id === state.platform && <span className="install__mine"> · {t.yourDevice}</span>}
              </button>
            ))}
          </div>
          <div id="install-panel" role="tabpanel" aria-labelledby={`install-tab-${platform}`}>
            <ol className="install__list">
              {steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {platform === state.platform && state.canPrompt && platform !== "ios" && <InstallButton className="btn btn--soft" />}
          </div>
        </section>
      )}

      <section aria-labelledby="install-benefits">
        <h2 id="install-benefits" className="visually-hidden">{t.benefitsTitle}</h2>
        <ul className="install__benefits">
          {t.benefits.map((b) => (
            <li key={b.title} className="card">
              <span className="install__benefit-icon" aria-hidden>{b.icon}</span>
              <strong>{b.title}</strong>
              <span className="muted">{b.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {state.platform === "desktop" && !state.installed && <PhoneQr />}

      <section className="card stack">
        <h2>{t.storesTitle}</h2>
        <p className="muted" style={{ margin: 0 }}>{t.storesText}</p>
      </section>
    </main>
  );
}
