import spanish from "@/i18n/messages/es";
import { msg, type Messages } from "@/i18n";
import type { PasswordIssue } from "../../supabase/functions/_shared/password";

const SPANISH_SERVER = spanish.errors.server;
const SPANISH_PASSWORD = spanish.auth.password;

/** Error de aplicación con un mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  constructor(
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AppError";
  }
}

type ErrorKey = Exclude<keyof Messages["errors"], "server">;

// Los mensajes del servidor (Supabase, funciones, triggers) llegan en inglés
// o en español: se reconocen por patrón y se muestran en el idioma activo.
const KNOWN: Array<[RegExp, ErrorKey]> = [
  [/Invalid login credentials/i, "badCredentials"],
  [/Email not confirmed/i, "emailNotConfirmed"],
  [/row-level security|permission denied|42501|No tienes permiso|Permiso insuficiente/i, "forbidden"],
  [/Failed to fetch|NetworkError|network/i, "network"],
  [/Payload too large|exceeded the maximum/i, "tooLarge"],
  [/rate limit|too many requests|over_email_send_rate_limit|For security purposes, you can only request/i, "rateLimitEmail"],
  [/New password should be different/i, "samePassword"],
  [/Password should be at least|weak.?password/i, "weakPassword"],
  [/Vas muy rápido/i, "tooFast"],
  [/al menos un super administrador/i, "lastSuperAdmin"],
];

/** Traduce cualquier error a un mensaje amable en el idioma activo. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const texts = msg().errors;
  for (const [pattern, key] of KNOWN) {
    if (pattern.test(message)) return texts[key];
  }
  return texts.generic;
}

/**
 * Las Edge Functions responden en español. Si el mensaje es uno de los
 * conocidos (o un problema de contraseña), se devuelve en el idioma activo;
 * si no, tal cual.
 */
export function fromServer(text: string): string {
  const t = msg();
  const key = (Object.keys(SPANISH_SERVER) as Array<keyof typeof SPANISH_SERVER>).find((k) => SPANISH_SERVER[k] === text.trim());
  if (key) return t.errors.server[key];
  const password = (Object.keys(SPANISH_PASSWORD) as PasswordIssue[]).find((k) => SPANISH_PASSWORD[k] === text.trim());
  if (password) return t.auth.password[password];
  for (const [pattern, k] of KNOWN) if (pattern.test(text)) return t.errors[k];
  return text;
}
