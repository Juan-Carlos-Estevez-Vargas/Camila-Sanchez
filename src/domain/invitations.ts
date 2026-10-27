/**
 * Enlaces de invitación: el token se genera en el navegador de quien invita,
 * en la base de datos sólo se guarda su SHA-256 y el token viaja en el
 * #fragmento de la URL (los navegadores no lo envían a ningún servidor).
 */
import type { Invitation, InvitableRole } from "./types";

export const INVITE_PATH = "/invitacion";
export const INVITABLE_ROLES: readonly InvitableRole[] = ["editor", "viewer"];
/** Debe coincidir con la Edge Function redeem-invite y la config de Auth. */
export { MIN_PASSWORD_LENGTH } from "./password";

export const INVITE_EXPIRY_OPTIONS = [
  { hours: 24, label: "24 horas" },
  { hours: 72, label: "3 días" },
  { hours: 168, label: "7 días" },
] as const;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** 256 bits al azar en base64url (43 caracteres). */
export function generateInviteToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function isInviteToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${INVITE_PATH}#${token}`;
}

/** Lee el token del #fragmento ("#abc" o "#token=abc"). */
export function readInviteToken(hash: string): string | null {
  const raw = hash.replace(/^#/, "").replace(/^token=/, "");
  return isInviteToken(raw) ? raw : null;
}

export type InvitationStatus = "pending" | "used" | "expired";

export function invitationStatus(invitation: Pick<Invitation, "usedAt" | "expiresAt">, now = new Date()): InvitationStatus {
  if (invitation.usedAt) return "used";
  return new Date(invitation.expiresAt) <= now ? "expired" : "pending";
}

export function expiryFromNow(hours: number, now = new Date()): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}
