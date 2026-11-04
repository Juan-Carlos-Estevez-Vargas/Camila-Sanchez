import { useId } from "react";
import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";
import {
  closeCookiePreferences, setCookieChoice, useCookieBannerOpen, useCookieChoice,
} from "@/services/consent/cookieConsent";
import { useT } from "@/i18n";

/**
 * Aviso de cookies. No bloquea la página ni tapa el contenido con un muro:
 * las dos opciones tienen el mismo tamaño y el mismo estilo, nada viene
 * marcado de antemano y se puede cambiar cuando se quiera desde el pie.
 */
export function CookieBanner() {
  const open = useCookieBannerOpen();
  const choice = useCookieChoice();
  const titleId = useId();
  const textId = useId();
  const t = useT().legal.cookies;
  if (!open) return null;

  return (
    <section className="cookie-banner" role="region" aria-labelledby={titleId} aria-describedby={textId}>
      <div className="cookie-banner__inner">
        <div className="cookie-banner__text">
          <h2 id={titleId} className="cookie-banner__title">
            <span aria-hidden>🍪</span> {t.title}
          </h2>
          <p id={textId}>
            {t.text}{" "}
            <Link to={legalPath("cookies")}>{t.more}</Link>
          </p>
          {choice && (
            <p className="cookie-banner__current">
              {t.now} {choice.externalFonts ? t.fontsOn : t.necessaryOnly}.
            </p>
          )}
        </div>
        <div className="cookie-banner__actions">
          <button type="button" className="btn" aria-pressed={choice ? !choice.externalFonts : undefined} onClick={() => setCookieChoice(false)}>
            {t.rejectFonts}
          </button>
          <button type="button" className="btn" aria-pressed={choice ? choice.externalFonts : undefined} onClick={() => setCookieChoice(true)}>
            {t.acceptFonts}
          </button>
          {choice && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={closeCookiePreferences}>
              {t.closeUnchanged}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
