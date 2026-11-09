/**
 * Verificación en dos pasos: códigos de 6 dígitos que cambian cada 30 s
 * (TOTP, RFC 6238), los mismos que muestran Google Authenticator, Microsoft
 * Authenticator, 1Password, etc.
 *
 * En producción los genera y comprueba Supabase Auth; esto lo usa el modo demo
 * (para probar con una app de verdad) y la validación del formulario.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_S = 30;

/** El código que escribe la persona: 6 dígitos (se ignoran espacios). */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, "");
}

export function isValidCode(input: string): boolean {
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalizeCode(input));
}

/** Secreto aleatorio de 160 bits en base32 (lo que guarda la app del celular). */
export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=]/g, "");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Secreto inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Enlace otpauth:// que se convierte en el código QR para escanear. */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_S) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** El secreto en grupos de 4 para copiarlo a mano si no se puede escanear. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Código de un momento dado (HOTP con el contador de 30 s). */
export async function totpAt(secret: string, timeMs: number, digits = TOTP_DIGITS): Promise<string> {
  const counter = Math.floor(timeMs / 1000 / TOTP_PERIOD_S);
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const keyBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey("raw", keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** ¿El código vale ahora? Acepta el anterior y el siguiente (relojes algo corridos). */
export async function verifyTotp(secret: string, code: string, nowMs = Date.now()): Promise<boolean> {
  const wanted = normalizeCode(code);
  if (!isValidCode(wanted)) return false;
  for (const step of [0, -1, 1]) {
    if ((await totpAt(secret, nowMs + step * TOTP_PERIOD_S * 1000)) === wanted) return true;
  }
  return false;
}
