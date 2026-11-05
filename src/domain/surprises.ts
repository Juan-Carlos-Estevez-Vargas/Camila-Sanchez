import type { Interruption, Uuid } from "./types";

/** ¿Está dentro de su ventana de tiempo y activa? */
export function isSurpriseLive(i: Interruption, now = Date.now()): boolean {
  return i.isActive && Date.parse(i.startsAt) <= now && (!i.endsAt || Date.parse(i.endsAt) > now);
}

/**
 * ¿Le toca ver esta sorpresa a `userId` al abrir la página?
 * Sólo a la persona elegida, nunca a quien la creó ni a quien no inició
 * sesión. Las antiguas (sin destinataria) le salen a todos menos a quien las
 * creó. La base aplica la misma regla con RLS.
 */
export function isSurpriseFor(i: Interruption, userId: Uuid | null | undefined): boolean {
  if (!userId || i.createdBy === userId) return false;
  const recipient = i.recipientId ?? null;
  return recipient === null || recipient === userId;
}

/**
 * ¿Ya le llegó a `userId`? Ya empezó y sigue activa, o ya la vio (aunque
 * después la apagaran). No importa si ya venció: lo recibido se queda en la
 * Cajita → Recibidas. La base aplica la misma regla con RLS.
 */
export function isSurpriseReceived(i: Interruption, userId: Uuid | null | undefined, seen: readonly Uuid[] = [], now = Date.now()): boolean {
  return isSurpriseFor(i, userId) && Date.parse(i.startsAt) <= now && (i.isActive || seen.includes(i.id));
}
