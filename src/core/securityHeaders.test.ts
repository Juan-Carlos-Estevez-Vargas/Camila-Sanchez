/**
 * Netlify (public/_headers) y Vercel (vercel.json) deben servir exactamente
 * las mismas cabeceras de seguridad, y la CSP no puede aflojarse sin querer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
      "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy",
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
});
