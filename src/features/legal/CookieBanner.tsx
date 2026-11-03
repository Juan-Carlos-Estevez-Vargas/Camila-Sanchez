import { useId } from "react";
import { Link } from "react-router-dom";
import { legalPath } from "@/domain/legal";
import {
  closeCookiePreferences, setCookieChoice, useCookieBannerOpen, useCookieChoice,
} from "@/services/consent/cookieConsent";

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
  if (!open) return null;

  return (
    <section className="cookie-banner" role="region" aria-labelledby={titleId} aria-describedby={textId}>
      <div className="cookie-banner__inner">
        <div className="cookie-banner__text">
          <h2 id={titleId} className="cookie-banner__title">
            <span aria-hidden>🍪</span> Tu privacidad
          </h2>
          <p id={textId}>
            No usamos cookies de publicidad ni de seguimiento. Tu navegador sólo guarda lo necesario para
            que la app funcione (tu sesión y tus preferencias). Lo único opcional son las tipografías de
            Google Fonts: si las aceptas, tu navegador se conecta a Google, que ve tu dirección IP.
            Si no, usamos las letras de tu dispositivo y todo funciona igual.{" "}
            <Link to={legalPath("cookies")}>Más detalles</Link>
          </p>
          {choice && (
            <p className="cookie-banner__current">
              Ahora: {choice.externalFonts ? "tipografías de Google activadas" : "sólo lo necesario"}.
            </p>
          )}
        </div>
        <div className="cookie-banner__actions">
          <button type="button" className="btn" aria-pressed={choice ? !choice.externalFonts : undefined} onClick={() => setCookieChoice(false)}>
            Sólo lo necesario
          </button>
          <button type="button" className="btn" aria-pressed={choice ? choice.externalFonts : undefined} onClick={() => setCookieChoice(true)}>
            Aceptar tipografías
          </button>
          {choice && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={closeCookiePreferences}>
              Cerrar sin cambiar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
