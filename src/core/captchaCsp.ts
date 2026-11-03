/**
 * Con el CAPTCHA (Cloudflare Turnstile) activado, la CSP tiene que dejar
 * cargar su script y su recuadro (un iframe) desde challenges.cloudflare.com.
 * Sin él, la CSP queda tal cual: no se abre nada a Cloudflare si no se usa.
 * vite.config.ts lo aplica al compilar a la etiqueta <meta> y a dist/_headers.
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const ADD_TO = ["script-src", "frame-src", "connect-src"] as const;

export function withCaptchaCsp(csp: string): string {
  const directives = csp.split(";").map((d) => d.trim()).filter(Boolean);
  for (const name of ADD_TO) {
    const index = directives.findIndex((d) => d === name || d.startsWith(`${name} `));
    if (index === -1) {
      directives.push(`${name} ${TURNSTILE_ORIGIN}`);
      continue;
    }
    const sources = directives[index]!.split(/\s+/).slice(1).filter((s) => s !== "'none'");
    if (!sources.includes(TURNSTILE_ORIGIN)) sources.push(TURNSTILE_ORIGIN);
    directives[index] = [name, ...sources].join(" ");
  }
  return directives.join("; ");
}

/** Cambia la CSP de un archivo _headers de Netlify. */
export function withCaptchaHeaders(headersFile: string): string {
  return headersFile.replace(/^(\s+Content-Security-Policy:\s*)(.+)$/gm, (_, prefix: string, csp: string) => prefix + withCaptchaCsp(csp));
}
