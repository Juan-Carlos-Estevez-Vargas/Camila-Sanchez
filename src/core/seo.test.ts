import { describe, expect, it } from "vitest";
import type { SiteSettings } from "@/domain/types";
import {
  buildRobotsTxt, buildSitemapXml, DEFAULT_TITLE, normalizeSiteUrl, resolveSeo, truncateDescription,
} from "./seo";

const settings = (patch: Partial<SiteSettings> = {}): SiteSettings => ({
  siteTitle: "Para el amor de mi vida",
  siteSubtitle: "Cada día contigo es mi recuerdo favorito.",
  relationshipStart: "2025-05-31",
  isPublic: true,
  musicUrl: null,
  theme: {} as SiteSettings["theme"],
  effects: {} as SiteSettings["effects"],
  updatedAt: "2026-10-15T00:00:00Z",
  ...patch,
});

const SITE = "https://nuestro-rincon.example";

describe("resolveSeo", () => {
  it("la portada pública se indexa con canónica, imagen absoluta y JSON-LD", () => {
    const seo = resolveSeo({ pathname: "/", settings: settings(), siteUrl: SITE, indexingEnabled: true });
    expect(seo.title).toBe("Para el amor de mi vida");
    expect(seo.description).toBe("Cada día contigo es mi recuerdo favorito.");
    expect(seo.robots).toMatch(/^index, follow/);
    expect(seo.canonical).toBe(`${SITE}/`);
    expect(seo.image).toBe(`${SITE}/og-image.jpg`);
    expect(seo.structuredData).toMatchObject({
      "@type": "WebSite", url: `${SITE}/`, inLanguage: "es-CO", image: `${SITE}/og-image.jpg`,
      author: { "@type": "Person", name: "Juan Carlos Estevez Vargas" },
    });
    expect(seo.imageAlt).toContain("Para el amor de mi vida");
  });

  it("una portada privada (sólo con cuenta) no se indexa", () => {
    const seo = resolveSeo({ pathname: "/", settings: settings({ isPublic: false }), siteUrl: SITE, indexingEnabled: true });
    expect(seo.robots).toBe("noindex, nofollow");
  });

  it("el interruptor global apaga la indexación", () => {
    expect(resolveSeo({ pathname: "/", settings: settings(), siteUrl: SITE, indexingEnabled: false }).robots).toBe("noindex, nofollow");
  });

  it("paneles, chat y acceso nunca se indexan y tienen su propio título", () => {
    for (const [path, title] of [["/panel/fotos", "Mi panel"], ["/super", "Administración"], ["/chat", "Chat"], ["/entrar", "Entrar"], ["/listas/abc", "Listas"], ["/cuenta/perfil", "Mi cuenta"]] as const) {
      const seo = resolveSeo({ pathname: path, settings: settings(), siteUrl: SITE, indexingEnabled: true });
      expect(seo.robots).toBe("noindex, nofollow");
      expect(seo.title).toBe(`${title} · Para el amor de mi vida`);
      expect(seo.canonical).toBeNull();
    }
  });

  it("sin ajustes ni dominio usa valores por defecto y rutas relativas", () => {
    const seo = resolveSeo({ pathname: "/", settings: null, siteUrl: "", indexingEnabled: true });
    expect(seo.title).toBe(DEFAULT_TITLE);
    expect(seo.canonical).toBeNull();
    expect(seo.image).toBe("/og-image.jpg");
    expect(seo.robots).toBe("noindex, nofollow"); // sin saber si es público, mejor no indexar
  });

  it("las rutas desconocidas no se indexan", () => {
    expect(resolveSeo({ pathname: "/nada", settings: settings(), siteUrl: SITE, indexingEnabled: true }).robots).toBe("noindex, nofollow");
  });

  it("/panelito no se confunde con /panel", () => {
    expect(resolveSeo({ pathname: "/panelito", settings: settings(), siteUrl: SITE, indexingEnabled: true }).title).toMatch(/^Página no encontrada/);
  });
});

describe("utilidades", () => {
  it("normaliza el dominio", () => {
    expect(normalizeSiteUrl(" https://a.example/// ")).toBe("https://a.example");
    expect(normalizeSiteUrl("a.example")).toBe("");
    expect(normalizeSiteUrl(undefined)).toBe("");
  });

  it("recorta descripciones largas sin partir palabras", () => {
    const long = "palabra ".repeat(40);
    const out = truncateDescription(long);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("palabra…")).toBe(true);
  });

  it("robots.txt bloquea zonas privadas y anuncia el sitemap", () => {
    const txt = buildRobotsTxt(SITE, true);
    expect(txt).toContain("Disallow: /panel");
    expect(txt).toContain("Disallow: /super");
    expect(txt).toContain("Disallow: /listas");
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(buildRobotsTxt(SITE, false)).toBe("User-agent: *\nDisallow: /\n");
  });

  it("sitemap.xml lista la portada", () => {
    const xml = buildSitemapXml(SITE, new Date("2026-10-15T12:00:00Z"));
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain("<lastmod>2026-10-15</lastmod>");
  });
});
