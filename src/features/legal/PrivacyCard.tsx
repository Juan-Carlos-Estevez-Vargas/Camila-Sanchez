import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LEGAL_VERSION, latestConsent, legalPath, type LegalConsent } from "@/domain/legal";
import { useBackend } from "@/state/BackendContext";
import { openCookiePreferences } from "@/services/consent/cookieConsent";
import { Contact } from "./documents/Contact";

const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" });

/** Mi cuenta → Privacidad: qué aceptaste y cuándo, y cómo ejercer tus derechos. */
export function PrivacyCard() {
  const backend = useBackend();
  const [consent, setConsent] = useState<LegalConsent | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    backend.legal.myConsents().then((all) => active && setConsent(latestConsent(all))).catch(() => active && setConsent(null));
    return () => {
      active = false;
    };
  }, [backend]);

  return (
    <section className="card stack" style={{ marginTop: 16 }} aria-labelledby="privacidad-titulo">
      <h2 id="privacidad-titulo" style={{ margin: 0, fontSize: "1.1rem" }}>Privacidad y tus datos 🔒</h2>
      <p className="muted" style={{ margin: 0 }}>
        {consent === undefined
          ? "Revisando…"
          : consent
            ? <>El {dateTime.format(new Date(consent.acceptedAt))} aceptaste los términos y la política de privacidad (versión {consent.version}).{consent.version !== LEGAL_VERSION && " Hay una versión nueva."}</>
            : "Todavía no hay registro de que aceptaras los términos."}
      </p>
      <p style={{ margin: 0 }}>
        Tu nombre, foto, frase y cumpleaños los cambias en tu perfil. Para pedir una copia de tus datos, que se corrijan
        o que se borre tu cuenta, escribe <Contact />: es gratis y se responde en máximo 15 días hábiles.
      </p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Link className="btn btn--soft btn--sm" to={legalPath("privacidad")}>Política de privacidad</Link>
        <Link className="btn btn--soft btn--sm" to={legalPath("terminos")}>Términos</Link>
        <button type="button" className="btn btn--soft btn--sm" onClick={openCookiePreferences}>Preferencias de cookies</button>
      </div>
    </section>
  );
}
