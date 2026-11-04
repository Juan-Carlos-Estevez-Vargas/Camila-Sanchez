import { lazy, Suspense, type ComponentType } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import { LEGAL_DOCUMENTS, LEGAL_UPDATED_ON, LEGAL_VERSION, legalDocument, legalPath, type LegalDocumentId } from "@/domain/legal";
import { formatLongDate } from "@/domain/dates";
import { useLocale, useT, type Locale } from "@/i18n";
import { Spinner } from "@/ui/Feedback";
import { Cookies } from "./documents/Cookies";
import { Licenses } from "./documents/Licenses";
import { Privacy } from "./documents/Privacy";
import { Refunds } from "./documents/Refunds";
import { Terms } from "./documents/Terms";

type Bodies = Record<LegalDocumentId, ComponentType>;

/** Documentos en español: la versión que vale legalmente. */
const SPANISH: Bodies = {
  privacidad: Privacy,
  terminos: Terms,
  cookies: Cookies,
  reembolsos: Refunds,
  licencias: Licenses,
};

/** Las traducciones se descargan sólo si se leen en ese idioma. */
const translated = (load: () => Promise<{ default: Bodies }>): Bodies => {
  const pick = (id: LegalDocumentId) => lazy(() => load().then((m) => ({ default: m.default[id] })));
  return { privacidad: pick("privacidad"), terminos: pick("terminos"), cookies: pick("cookies"), reembolsos: pick("reembolsos"), licencias: pick("licencias") };
};

const BODIES: Record<Locale, Bodies> = {
  es: SPANISH,
  en: translated(() => import("./documents/en")),
  pt: translated(() => import("./documents/pt")),
};

/** Índice de documentos legales (/legal). */
function LegalIndex() {
  const t = useT().legal;
  return (
    <main id="contenido-principal" className="container legal">
      <h1>{t.indexTitle}</h1>
      <p className="muted">{t.indexIntro}</p>
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.id} className="card">
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}><Link to={legalPath(doc.id)}>{t.docs[doc.id].title}</Link></h2>
            <p className="muted" style={{ margin: 0 }}>{t.docs[doc.id].summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Páginas públicas: se pueden leer sin cuenta y aunque la página sea privada. */
export default function LegalPage() {
  const { doc: id } = useParams();
  const t = useT().legal;
  const locale = useLocale();
  if (!id) return <LegalIndex />;
  const doc = legalDocument(id);
  if (!doc) return <Navigate to="/legal" replace />;
  const Body = BODIES[locale][doc.id];
  const texts = t.docs[doc.id];

  return (
    <main id="contenido-principal" className="container legal">
      <article>
        <h1>{texts.title}</h1>
        <p className="legal__meta">
          {t.updatedOn} <time dateTime={LEGAL_UPDATED_ON}>{formatLongDate(LEGAL_UPDATED_ON)}</time> · {t.version} {LEGAL_VERSION}
        </p>
        {t.translationNotice && <p className="legal__notice" role="note">{t.translationNotice}</p>}
        <p className="legal__summary">{texts.summary}</p>
        <Suspense fallback={<Spinner />}>
          <Body />
        </Suspense>
      </article>
      <nav aria-label={t.otherDocs}>
        <ul className="legal__nav">
          {LEGAL_DOCUMENTS.filter((d) => d.id !== doc.id).map((d) => (
            <li key={d.id}><NavLink className="btn btn--soft btn--sm" to={legalPath(d.id)}>{t.docs[d.id].short}</NavLink></li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
