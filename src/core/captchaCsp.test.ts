import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TURNSTILE_ORIGIN, withCaptchaCsp, withCaptchaHeaders } from "./captchaCsp";

const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `));

describe("CSP con CAPTCHA", () => {
  it("abre sólo script, iframe y conexión a Cloudflare", () => {
    const csp = withCaptchaCsp("default-src 'self'; script-src 'self'; frame-src 'none'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'");
    expect(directive(csp, "script-src")).toBe(`script-src 'self' ${TURNSTILE_ORIGIN}`);
    expect(directive(csp, "frame-src")).toBe(`frame-src ${TURNSTILE_ORIGIN}`);
    expect(directive(csp, "connect-src")).toBe(`connect-src 'self' https://*.supabase.co ${TURNSTILE_ORIGIN}`);
    // Nadie puede incrustar la app aunque ella incruste el CAPTCHA.
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline' https://challenges");
  });

  it("agrega frame-src si la CSP no lo tenía y no repite el origen", () => {
    const once = withCaptchaCsp("default-src 'self'; script-src 'self'");
    expect(directive(once, "frame-src")).toBe(`frame-src ${TURNSTILE_ORIGIN}`);
    expect(withCaptchaCsp(once)).toBe(once);
  });

  it("cambia la CSP de public/_headers y nada más", () => {
    const original = readFileSync(join(__dirname, "..", "..", "public", "_headers"), "utf8");
    const changed = withCaptchaHeaders(original);
    expect(changed).toContain(`script-src 'self' ${TURNSTILE_ORIGIN}`);
    expect(changed).toContain(`frame-src https://www.youtube-nocookie.com https://open.spotify.com ${TURNSTILE_ORIGIN}`);
    expect(changed.split("\n").length).toBe(original.split("\n").length);
    expect(changed.replace(/^.*Content-Security-Policy.*$/m, "")).toBe(original.replace(/^.*Content-Security-Policy.*$/m, ""));
  });
});
