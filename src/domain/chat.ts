/**
 * Reglas del chat tipo WhatsApp: última conexión, vistos y citas.
 * Funciones puras para poder probarlas sin navegador ni base de datos.
 */
import { stickerById } from "./stickers";
import type { ChatConversation, ChatKind, ChatMessage, ChatParticipant, ChatPresence, ChatReaction, Uuid } from "./types";
import { dateFormat, msg } from "@/i18n/store";

/** Cada cuánto avisa la app de que la persona sigue conectada. */
export const PRESENCE_HEARTBEAT_MS = 30_000;
/** Margen para seguir mostrando «en línea» (dos latidos y un poco). */
export const ONLINE_WINDOW_MS = 75_000;

const time = () => dateFormat({ hour: "numeric", minute: "2-digit" });
const day = () => dateFormat({ day: "numeric", month: "long" });

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
  const t = msg().chat;
  if (isOnline(lastSeenAt, now)) return t.online;
  const minutes = Math.max(1, Math.round((now.getTime() - seen.getTime()) / 60_000));
  if (minutes < 60) return t.lastSeen.minutes(minutes);
  const days = Math.round((startOfDay(now) - startOfDay(seen)) / 86_400_000);
  if (days <= 0) return t.lastSeen.today(time().format(seen));
  if (days === 1) return t.lastSeen.yesterday(time().format(seen));
  return t.lastSeen.on(day().format(seen));
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
export function messagePreview(message: { kind?: ChatKind; body: string; sticker?: string | null; deleted?: boolean; deletedAt?: string | null }, max = 90): string {
  const t = msg().chat;
  if (message.deleted || message.deletedAt) return t.deleted;
  if (message.kind === "sticker") {
    const sticker = stickerById(message.sticker);
    return t.stickerPreview(sticker.emoji, sticker.text);
  }
  if (message.kind === "image") {
    const caption = quoteSnippet(message.body, Math.max(max - 9, 10));
    return caption ? t.photoWithCaption(caption) : t.photoPreview;
  }
  return quoteSnippet(message.body, max);
}

/** Junta o actualiza la conexión de una persona en la lista. */
export function upsertPresence(list: readonly ChatPresence[], next: ChatPresence): ChatPresence[] {
  return [...list.filter((p) => p.userId !== next.userId), next];
}

/** Texto que queda en lugar de un mensaje borrado para todos (en el idioma activo). */
export function deletedLabel(): string {
  return msg().chat.deleted;
}

/** Reacciones disponibles (las mismas que acepta la base de datos). */
export const REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍", "🔥", "🥰"] as const;

/** Minutos durante los que se puede editar un mensaje. */
export const EDIT_WINDOW_MS = 15 * 60_000;
/** «escribiendo…» se muestra este tiempo después de la última tecla. */
export const TYPING_WINDOW_MS = 6_000;
/** Cada cuánto se avisa «estoy escribiendo» mientras se teclea. */
export const TYPING_THROTTLE_MS = 2_500;

export function isTyping(typingAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!typingAt) return false;
  const elapsed = now.getTime() - new Date(typingAt).getTime();
  return elapsed >= -5_000 && elapsed < TYPING_WINDOW_MS;
}

/** ¿Puedo editar este mensaje? Sólo el propio, de texto o foto, los primeros 15 min. */
export function canEditMessage(
  message: Pick<ChatMessage, "senderId" | "kind" | "createdAt" | "deletedAt">,
  userId: Uuid | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(userId) && message.senderId === userId && !message.deletedAt && message.kind !== "sticker"
    && now.getTime() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;
}

/** Pone, cambia o quita (si es la misma) la reacción de una persona. */
export function toggleReaction(reactions: readonly ChatReaction[], userId: Uuid, emoji: string): { next: ChatReaction[]; emoji: string | null } {
  const mine = reactions.find((r) => r.userId === userId);
  const others = reactions.filter((r) => r.userId !== userId);
  if (mine?.emoji === emoji) return { next: others, emoji: null };
  return { next: [...others, { userId, emoji }], emoji };
}

/** Reacciones agrupadas por emoji, en el orden en que aparecieron. */
export function groupReactions(reactions: readonly ChatReaction[]): Array<{ emoji: string; userIds: Uuid[] }> {
  const groups = new Map<string, Uuid[]>();
  for (const r of reactions) groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), r.userId]);
  return [...groups].map(([emoji, userIds]) => ({ emoji, userIds }));
}

/** Fijados arriba; luego por el último movimiento, del más reciente al más viejo. */
export function sortConversations<T extends Pick<ChatConversation, "pinnedAt" | "lastMessageAt" | "createdAt">>(list: readonly T[]): T[] {
  const activity = (c: T) => c.lastMessageAt ?? c.createdAt;
  return [...list].sort((a, b) => {
    if (Boolean(a.pinnedAt) !== Boolean(b.pinnedAt)) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt && a.pinnedAt !== b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt);
    return activity(b).localeCompare(activity(a));
  });
}

/** La otra persona de un chat directo (o la primera que no soy yo). */
export function otherParticipant(conversation: Pick<ChatConversation, "participantIds">, me: Uuid | null | undefined): Uuid | null {
  return conversation.participantIds.find((id) => id !== me) ?? null;
}

/** Sin tildes ni mayúsculas, para buscar «camila» y encontrar «Camíla». */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesSearch(text: string, query: string): boolean {
  const q = normalizeSearch(query);
  return q === "" || normalizeSearch(text).includes(q);
}



/** Hora de la bandeja: «3:15 p. m.», «ayer», «lunes» o «12/10/26». */
export function inboxTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return time().format(date);
  if (days === 1) return msg().chat.yesterday;
  if (days < 7) return dateFormat({ weekday: "long" }).format(date);
  return dateFormat({ day: "numeric", month: "numeric", year: "2-digit" }).format(date);
}

/**
 * Vistos de una conversación en el formato de receiptOf/readersOf: la
 * conexión es global (chat_reads) y la lectura, la de esta conversación.
 */
export function conversationPresences(
  participants: readonly ChatParticipant[],
  presences: readonly ChatPresence[],
): ChatPresence[] {
  return participants.map((p) => ({
    userId: p.userId,
    lastSeenAt: maxIso(presences.find((x) => x.userId === p.userId)?.lastSeenAt, p.lastReadAt) ?? new Date(0).toISOString(),
    lastReadAt: p.lastReadAt,
  }));
}

function maxIso(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/** Junta o actualiza los vistos/«escribiendo» de una persona en la lista. */
export function upsertParticipant(list: readonly ChatParticipant[], next: ChatParticipant): ChatParticipant[] {
  return [...list.filter((p) => !(p.userId === next.userId && p.conversationId === next.conversationId)), next];
}
