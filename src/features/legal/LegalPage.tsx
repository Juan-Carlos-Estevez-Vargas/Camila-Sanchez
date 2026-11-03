import type { ComponentType } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import { LEGAL_DOCUMENTS, LEGAL_UPDATED_ON, LEGAL_VERSION, legalDocument, legalPath, type LegalDocumentId } from "@/domain/legal";
import { formatLongDate } from "@/domain/dates";
import { Cookies } from "./documents/Cookies";
import { Licenses } from "./documents/Licenses";
import { Privacy } from "./documents/Privacy";
import { Refunds } from "./documents/Refunds";
import { Terms } from "./documents/Terms";

const BODIES: Record<LegalDocumentId, ComponentType> = {
  privacidad: Privacy,
  terminos: Terms,
  cookies: Cookies,
  reembolsos: Refunds,
  licencias: Licenses,
};

/** Índice de documentos legales (/legal). */
function LegalIndex() {
  return (
    <main id="contenido-principal" className="container legal">
      <h1>Legal y privacidad</h1>
      <p className="muted">Todo lo que necesitas saber sobre tus datos y las reglas de la app, en palabras sencillas.</p>
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.id} className="card">
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}><Link to={legalPath(doc.id)}>{doc.title}</Link></h2>
            <p className="muted" style={{ margin: 0 }}>{doc.summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Páginas públicas: se pueden leer sin cuenta y aunque la página sea privada. */
export default function LegalPage() {
  const { doc: id } = useParams();
  if (!id) return <LegalIndex />;
  const doc = legalDocument(id);
  if (!doc) return <Navigate to="/legal" replace />;
  const Body = BODIES[doc.id];

  return (
    <main id="contenido-principal" className="container legal">
      <article>
        <h1>{doc.title}</h1>
        <p className="legal__meta">
          Última actualización: <time dateTime={LEGAL_UPDATED_ON}>{formatLongDate(LEGAL_UPDATED_ON)}</time> · versión {LEGAL_VERSION}
        </p>
        <p className="legal__summary">{doc.summary}</p>
        <Body />
      </article>
      <nav aria-label="Otros documentos legales">
        <ul className="legal__nav">
          {LEGAL_DOCUMENTS.filter((d) => d.id !== doc.id).map((d) => (
            <li key={d.id}><NavLink className="btn btn--soft btn--sm" to={legalPath(d.id)}>{d.short}</NavLink></li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
