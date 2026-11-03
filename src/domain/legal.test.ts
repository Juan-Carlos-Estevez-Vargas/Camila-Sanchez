import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSeo } from "@/core/seo";
import {
  CONSENT_DOCUMENTS, LEGAL_DOCUMENTS, LEGAL_VERSION, hasCurrentConsent, latestConsent, legalDocument, legalPath,
  markConsentPending, takePendingConsent,
} from "./legal";

describe("documentos legales", () => {
  it("cada documento tiene su ruta y se encuentra por id", () => {
    for (const doc of LEGAL_DOCUMENTS) expect(legalDocument(doc.id)).toBe(doc);
    expect(legalPath("privacidad")).toBe("/legal/privacidad");
    expect(legalDocument("no-existe")).toBeUndefined();
  });

  it("al crear la cuenta se aceptan términos y privacidad", () => {
    expect(CONSENT_DOCUMENTS).toEqual(["terminos", "privacidad"]);
  });

  it("la versión es una fecha (la base de datos lo exige)", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("aceptaciones", () => {
  const old = { version: "2025-01-01", acceptedAt: "2025-01-02T10:00:00Z" };
  const current = { version: LEGAL_VERSION, acceptedAt: "2026-11-03T10:00:00Z" };

  it("sólo cuenta la versión vigente", () => {
    expect(hasCurrentConsent([])).toBe(false);
    expect(hasCurrentConsent([old])).toBe(false);
    expect(hasCurrentConsent([old, current])).toBe(true);
  });

  it("la más reciente es la última aceptada", () => {
    expect(latestConsent([old, current])).toEqual(current);
    expect(latestConsent([])).toBeNull();
  });
});

describe("aceptación pendiente al crear la cuenta", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });
  afterEach(() => {
    // @ts-expect-error: limpiar el doble de prueba
    delete globalThis.sessionStorage;
  });

  it("se usa una sola vez y sólo con el mismo correo", () => {
    markConsentPending(" Cami@Example.com ");
    expect(takePendingConsent("otra@example.com")).toBe(false);
    expect(takePendingConsent("cami@example.com")).toBe(true);
    expect(takePendingConsent("cami@example.com")).toBe(false);
  });

  it("sin almacenamiento no revienta", () => {
    // @ts-expect-error: navegador sin sessionStorage
    delete globalThis.sessionStorage;
    expect(() => markConsentPending("a@b.co")).not.toThrow();
    expect(takePendingConsent("a@b.co")).toBe(false);
  });
});

describe("SEO de las páginas legales", () => {
  const base = { settings: null, siteUrl: "https://ejemplo.netlify.app", indexingEnabled: true };

  it("son públicas e indexables aunque el sitio sea privado", () => {
    const seo = resolveSeo({ ...base, pathname: "/legal/privacidad" });
    expect(seo.title).toContain("Política de privacidad");
    expect(seo.robots).toContain("index");
    expect(seo.robots).not.toContain("noindex");
    expect(seo.canonical).toBe("https://ejemplo.netlify.app/legal/privacidad");
  });

  it("el índice tiene título propio y un documento inventado no", () => {
    expect(resolveSeo({ ...base, pathname: "/legal" }).title).toContain("Legal y privacidad");
    expect(resolveSeo({ ...base, pathname: "/legal/otra" }).title).toContain("no encontrada");
  });

  it("respetan el interruptor global de indexación", () => {
    expect(resolveSeo({ ...base, indexingEnabled: false, pathname: "/legal/terminos" }).robots).toBe("noindex, nofollow");
  });
});
