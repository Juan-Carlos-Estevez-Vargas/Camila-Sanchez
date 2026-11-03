/**
 * Textos legales: qué documentos hay, su versión vigente y quién responde por
 * los datos. Los textos en sí viven en features/legal/documents.
 *
 * Son plantillas pensadas para una app privada, gratuita y sin publicidad que
 * se usa en Colombia (Ley 1581 de 2012 y Decreto 1074 de 2015). No son
 * asesoría legal: si la app cambia de propósito o crece, que los revise una
 * persona abogada.
 */

/**
 * Versión de los términos y la política de privacidad. Al cambiar algo
 * importante en esos textos, súbela: a quien ya aceptó la anterior se le
 * vuelve a pedir que lea y acepte la nueva.
 */
export const LEGAL_VERSION = "2026-11-03";

/** Fecha que se muestra como «última actualización» en cada documento. */
export const LEGAL_UPDATED_ON = "2026-11-03";

/** Quién es el responsable del tratamiento de los datos (Ley 1581, art. 3). */
export const DATA_CONTROLLER = {
  name: "Juan Carlos Estevez Vargas",
  country: "Colombia",
  /**
   * Correo para ejercer los derechos sobre los datos. Si se deja vacío, los
   * textos indican escribirle a Juan por el chat de la app o por sus redes.
   */
  email: "juank2001estevezvargas@gmail.com",
} as const;

export type LegalDocumentId = "privacidad" | "terminos" | "cookies" | "reembolsos" | "licencias";

export interface LegalDocumentMeta {
  id: LegalDocumentId;
  title: string;
  /** Texto corto para el pie de página. */
  short: string;
  summary: string;
}

export const LEGAL_PATH = "/legal";

export const LEGAL_DOCUMENTS: readonly LegalDocumentMeta[] = [
  { id: "privacidad", title: "Política de privacidad y tratamiento de datos", short: "Privacidad", summary: "Qué datos guardamos, para qué, dónde y cómo pedir que los veas, corrijas o borres." },
  { id: "terminos", title: "Términos y condiciones", short: "Términos", summary: "Las reglas para usar la app: quién puede entrar, qué se puede subir y qué no." },
  { id: "cookies", title: "Política de cookies y almacenamiento", short: "Cookies", summary: "La app no usa cookies de seguimiento: esto es lo que guarda tu navegador y por qué." },
  { id: "reembolsos", title: "Cobros y reembolsos", short: "Cobros y reembolsos", summary: "La app es gratis: no hay pagos, suscripciones ni cobros ocultos." },
  { id: "licencias", title: "Licencias y créditos", short: "Licencias", summary: "De dónde salen el código, las tipografías, los iconos y las fotos, y con qué licencia." },
];

export const legalPath = (id: LegalDocumentId): string => `${LEGAL_PATH}/${id}`;

export const legalDocument = (id: string | undefined): LegalDocumentMeta | undefined =>
  LEGAL_DOCUMENTS.find((doc) => doc.id === id);

/** Documentos que se aceptan al crear la cuenta (y cada vez que cambian). */
export const CONSENT_DOCUMENTS = ["terminos", "privacidad"] as const satisfies readonly LegalDocumentId[];

export interface LegalConsent {
  version: string;
  acceptedAt: string;
}

/** ¿Ya aceptó esta persona la versión vigente? */
export function hasCurrentConsent(consents: readonly LegalConsent[], version = LEGAL_VERSION): boolean {
  return consents.some((c) => c.version === version);
}

/** La aceptación más reciente, para mostrarla en Mi cuenta. */
export function latestConsent(consents: readonly LegalConsent[]): LegalConsent | null {
  return [...consents].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0] ?? null;
}

/**
 * Al crear la cuenta con una invitación se marca la casilla antes de que
 * exista el usuario. Se recuerda en esta pestaña (atado al correo) y, al
 * entrar por primera vez, se guarda la aceptación sin volver a preguntar.
 */
const PENDING_KEY = "legal:pending-consent";

interface PendingConsent {
  email: string;
  version: string;
}

export function markConsentPending(email: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.trim().toLowerCase(), version: LEGAL_VERSION } satisfies PendingConsent));
  } catch {
    // Sin almacenamiento: se le preguntará otra vez al entrar.
  }
}

/** Devuelve (y borra) la aceptación pendiente si es de este correo y de la versión vigente. */
export function takePendingConsent(email: string | null | undefined): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    const pending = JSON.parse(raw) as Partial<PendingConsent>;
    const matches = Boolean(email) && pending.email === email!.trim().toLowerCase() && pending.version === LEGAL_VERSION;
    if (matches) sessionStorage.removeItem(PENDING_KEY);
    return matches;
  } catch {
    return false;
  }
}
