/**
 * Comprueba la ficha del CAPTCHA (Cloudflare Turnstile) con Cloudflare.
 *
 * Sólo si la función tiene el secreto TURNSTILE_SECRET_KEY (lo pone el flujo
 * Deploy cuando existe el secreto de GitHub del mismo nombre). Sin él, el
 * CAPTCHA está apagado y no se pide nada.
 */
const SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const captchaRequired = SECRET !== "";

export async function captchaOk(token: unknown, ip: string): Promise<boolean> {
  if (!captchaRequired) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  try {
    const form = new FormData();
    form.append("secret", SECRET);
    form.append("response", token);
    if (ip && ip !== "desconocida") form.append("remoteip", ip);
    const response = await fetch(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("[captcha]", error);
    return false;
  }
}

export const CAPTCHA_FAILED = "No pude comprobar que no eres un robot. Recarga la página e inténtalo otra vez.";
