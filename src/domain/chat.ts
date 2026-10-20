/**
 * Reglas del chat tipo WhatsApp: última conexión, vistos y citas.
 * Funciones puras para poder probarlas sin navegador ni base de datos.
 */
import { stickerById } from "./stickers";
import type { ChatKind, ChatMessage, ChatPresence, Uuid } from "./types";

/** Cada cuánto avisa la app de que la persona sigue conectada. */
export const PRESENCE_HEARTBEAT_MS = 30_000;
/** Margen para seguir mostrando «en línea» (dos latidos y un poco). */
export const ONLINE_WINDOW_MS = 75_000;

const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isOnline(lastSeenAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/**
 * Texto de la última conexión, como en WhatsApp:
 * «en línea», «últ. vez hace 5 min», «últ. vez hoy a las 3:15 p. m.»,
 * «últ. vez ayer a las…» o «últ. vez el 12 de octubre».
 */
export function lastSeenLabel(lastSeenAt: string, now: Date = new Date()): string {
  const seen = new Date(lastSeenAt);
  if (isOnline(lastSeenAt, now)) return "en línea";
  const minutes = Math.max(1, Math.round((now.getTime() - seen.getTime()) / 60_000));
  if (minutes < 60) return `últ. vez hace ${minutes} min`;
  const days = Math.round((startOfDay(now) - startOfDay(seen)) / 86_400_000);
  if (days <= 0) return `últ. vez hoy a las ${time.format(seen)}`;
  if (days === 1) return `últ. vez ayer a las ${time.format(seen)}`;
  return `últ. vez el ${day.format(seen)}`;
}

export type Receipt = "sending" | "failed" | "sent" | "delivered" | "read";

/**
 * Estado de un mensaje propio frente a las demás personas del chat:
 * ✓ enviado, ✓✓ entregado (alguien se conectó después) y ✓✓ azul visto.
 */
export function receiptOf(
  message: Pick<ChatMessage, "senderId" | "createdAt"> & { pending?: boolean; failed?: boolean },
  presences: readonly ChatPresence[],
): Receipt {
  if (message.failed) return "failed";
  if (message.pending) return "sending";
  const others = presences.filter((p) => p.userId !== message.senderId);
  const sentAt = new Date(message.createdAt).getTime();
  if (others.some((p) => p.lastReadAt && new Date(p.lastReadAt).getTime() >= sentAt)) return "read";
  if (others.some((p) => new Date(p.lastSeenAt).getTime() >= sentAt)) return "delivered";
  return "sent";
}

/** Quiénes (además de quien lo envió) ya vieron un mensaje. */
export function readersOf(message: Pick<ChatMessage, "senderId" | "createdAt">, presences: readonly ChatPresence[]): Uuid[] {
  const sentAt = new Date(message.createdAt).getTime();
  return presences
    .filter((p) => p.userId !== message.senderId && p.lastReadAt && new Date(p.lastReadAt).getTime() >= sentAt)
    .map((p) => p.userId);
}

/** Fragmento de un mensaje para mostrarlo citado (una línea). */
export function quoteSnippet(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Texto corto de cualquier mensaje: para citas y avisos. */
export function messagePreview(message: { kind?: ChatKind; body: string; sticker?: string | null }, max = 90): string {
  if (message.kind === "sticker") {
    const sticker = stickerById(message.sticker);
    return `${sticker.emoji} Sticker «${sticker.text}»`;
  }
  if (message.kind === "image") {
    const caption = quoteSnippet(message.body, Math.max(max - 9, 10));
    return caption ? `📷 Foto: ${caption}` : "📷 Foto";
  }
  return quoteSnippet(message.body, max);
}

/** Junta o actualiza la conexión de una persona en la lista. */
export function upsertPresence(list: readonly ChatPresence[], next: ChatPresence): ChatPresence[] {
  return [...list.filter((p) => p.userId !== next.userId), next];
}
