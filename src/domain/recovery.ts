/**
 * Recuperación de contraseña.
 *
 * El enlace lleva un `token_hash` de un solo uso en el #fragmento (nunca llega
 * a los registros del servidor ni a la cabecera Referer). Funciona aunque se
 * abra en otro dispositivo distinto al que pidió el correo, a diferencia del
 * intercambio PKCE, que exige el mismo navegador.
 *
 * Lo crean el correo de Supabase (plantilla configurada por el flujo Deploy)
 * o el super administrador desde Usuarios, sin depender del correo.
 */
export const RECOVERY_PATH = "/recuperar";

/** Lo que dura un enlace de recuperación (mailer_otp_exp de Supabase). */
export const RECOVERY_LINK_HOURS = 1;

const TOKEN_HASH = /^[A-Za-z0-9_-]{16,256}$/;

export function isRecoveryTokenHash(value: string): boolean {
  return TOKEN_HASH.test(value);
}

export function buildRecoveryUrl(origin: string, tokenHash: string): string {
  return `${origin.replace(/\/+$/, "")}${RECOVERY_PATH}#token_hash=${encodeURIComponent(tokenHash)}`;
}

export type RecoveryLink =
  | { kind: "token"; tokenHash: string }
  /** Supabase devuelve el error en el fragmento cuando el enlace ya no sirve. */
  | { kind: "error"; expired: boolean }
  | { kind: "none" };

/** Lee el #fragmento (o la consulta) con el que se abrió /recuperar. */
export function readRecoveryLink(hashOrSearch: string): RecoveryLink {
  const params = new URLSearchParams(hashOrSearch.replace(/^[#?]/, ""));
  if (params.has("error") || params.has("error_code")) {
    return { kind: "error", expired: params.get("error_code") === "otp_expired" };
  }
  const tokenHash = params.get("token_hash") ?? "";
  return isRecoveryTokenHash(tokenHash) ? { kind: "token", tokenHash } : { kind: "none" };
}
