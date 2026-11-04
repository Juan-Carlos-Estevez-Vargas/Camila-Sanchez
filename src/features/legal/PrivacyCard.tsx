import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LEGAL_VERSION, latestConsent, legalPath, type LegalConsent } from "@/domain/legal";
import { useBackend } from "@/state/BackendContext";
import { openCookiePreferences } from "@/services/consent/cookieConsent";
import { Contact } from "./documents/Contact";
import { dateFormat, useT } from "@/i18n";


/** Mi cuenta → Privacidad: qué aceptaste y cuándo, y cómo ejercer tus derechos. */
export function PrivacyCard() {
  const backend = useBackend();
  const [consent, setConsent] = useState<LegalConsent | null | undefined>(undefined);
  const t = useT().legal.card;
  const dateTime = dateFormat({ dateStyle: "long", timeStyle: "short" });

  useEffect(() => {
    let active = true;
    backend.legal.myConsents().then((all) => active && setConsent(latestConsent(all))).catch(() => active && setConsent(null));
    return () => {
      active = false;
    };
  }, [backend]);

  return (
    <section className="card stack" style={{ marginTop: 16 }} aria-labelledby="privacidad-titulo">
      <h2 id="privacidad-titulo" style={{ margin: 0, fontSize: "1.1rem" }}>{t.title}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {consent === undefined
          ? t.checking
          : consent
            ? <>{t.accepted(dateTime.format(new Date(consent.acceptedAt)), consent.version)}{consent.version !== LEGAL_VERSION && t.newVersion}</>
            : t.none}
      </p>
      <p style={{ margin: 0 }}>
        {t.rightsBefore} <Contact />{t.rightsAfter}
      </p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Link className="btn btn--soft btn--sm" to={legalPath("privacidad")}>{t.privacy}</Link>
        <Link className="btn btn--soft btn--sm" to={legalPath("terminos")}>{t.terms}</Link>
        <button type="button" className="btn btn--soft btn--sm" onClick={openCookiePreferences}>{t.cookiePrefs}</button>
      </div>
    </section>
  );
}
