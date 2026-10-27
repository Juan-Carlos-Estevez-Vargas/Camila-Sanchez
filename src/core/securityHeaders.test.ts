/**
 * Netlify (public/_headers) y Vercel (vercel.json) deben servir exactamente
 * las mismas cabeceras de seguridad, y la CSP no puede aflojarse sin querer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVATE_PREFIXES } from "./seo";

const ROOT = join(__dirname, "..", "..");

function netlifyGlobalHeaders(): Record<string, string> {
  const lines = readFileSync(join(ROOT, "public", "_headers"), "utf8").split("\n");
  const start = lines.indexOf("/*");
  const headers: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    const [key, ...value] = line.trim().split(":");
    headers[key!] = value.join(":").trim();
  }
  return headers;
}

function vercelGlobalHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  const block = config.headers.find((h) => h.source === "/(.*)")!;
  return Object.fromEntries(block.headers.map((h) => [h.key, h.value]));
}

describe("cabeceras de seguridad", () => {
  const netlify = netlifyGlobalHeaders();

  it("son iguales en Netlify y en Vercel", () => {
    expect(netlify).toEqual(vercelGlobalHeaders());
  });

  it("incluyen CSP, HSTS y protección contra iframes", () => {
    expect(Object.keys(netlify)).toEqual(expect.arrayContaining([
      "Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options",
      "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy",
    ]));
  });

  it("la CSP no permite scripts en línea ni de otros sitios", () => {
    const csp = netlify["Content-Security-Policy"]!;
    const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("las imágenes sólo vienen del propio sitio o de Supabase", () => {
    const imgSrc = netlify["Content-Security-Policy"]!.split(";").map((d) => d.trim()).find((d) => d.startsWith("img-src"));
    expect(imgSrc).toBe("img-src 'self' data: blob: https://*.supabase.co");
  });

  it("nadie puede incrustar los archivos del sitio desde otro dominio", () => {
    expect(netlify["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(netlify["X-Permitted-Cross-Domain-Policies"]).toBe("none");
  });
});

describe("zonas privadas fuera de buscadores", () => {
  const headersFile = readFileSync(join(ROOT, "public", "_headers"), "utf8");
  const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  const noindex = vercel.headers.find((h) => h.headers.some((x) => x.key === "X-Robots-Tag"))!;
  const vercelPattern = new RegExp(`^${noindex.source}$`);

  it.each(PRIVATE_PREFIXES.map((p) => [p]))("%s lleva X-Robots-Tag en Netlify y Vercel", (prefix) => {
    expect(headersFile).toMatch(new RegExp(`^${prefix}\\n  X-Robots-Tag: noindex, nofollow`, "m"));
    expect(vercelPattern.test(prefix)).toBe(true);
  });
});
