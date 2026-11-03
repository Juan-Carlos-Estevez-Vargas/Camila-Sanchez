/**
 * Chat del modo demo: contactos, solicitudes, conversaciones, reacciones y
 * vistos, con las mismas reglas que la migración 015 de Supabase (quién ve
 * qué, quién puede escribir, avisos sólo a quienes están en el chat).
 */
import { set as idbSet, del as idbDel } from "idb-keyval";
import { AppError } from "@/core/errors";
import { EDIT_WINDOW_MS, messagePreview, REACTIONS, upsertPresence } from "@/domain/chat";
import { isKnownSticker } from "@/domain/stickers";
import type {
  AppNotification, ChatContact, ChatConversation, ChatImage, ChatMessage, ChatParticipant, ChatPerson, ChatPresence,
  ChatReaction, Profile, Uuid,
} from "@/domain/types";
import type { MessagingRepository, RealtimeChange } from "@/data/ports";

export interface DemoConversation {
  id: Uuid;
  kind: "direct" | "group";
  title: string;
  directKey: string | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface DemoParticipant extends ChatParticipant {
  joinedAt: string;
  pinnedAt: string | null;
  archivedAt: string | null;
  muted: boolean;
  clearedAt: string | null;
}

export interface DemoBlock {
  blockerId: Uuid;
  blockedId: Uuid;
}

export interface DemoReaction extends ChatReaction {
  messageId: Uuid;
  createdAt: string;
}

export interface DemoChatState {
  chat: ChatMessage[];
  chatReads: ChatPresence[];
  chatConversations: DemoConversation[];
  chatParticipants: DemoParticipant[];
  chatContacts: ChatContact[];
  chatBlocks: DemoBlock[];
  chatReactions: DemoReaction[];
  /** Mensajes borrados sólo para alguien: «userId:messageId». */
  chatHidden: string[];
  notifications: AppNotification[];
  users: Array<Pick<Profile, "id" | "displayName" | "avatarPath" | "avatarEmoji" | "bio" | "isActive">>;
}

export interface DemoChatDeps {
  state(): DemoChatState;
  commit(change: Omit<RealtimeChange, "old"> & { old?: RealtimeChange["old"] }): void;
  /** Quien tiene la sesión, si puede usar el chat (si no, lanza). */
  me(): { id: Uuid; displayName: string };
  canChat(userId: Uuid): boolean;
  notify(userId: Uuid, kind: AppNotification["kind"], title: string, body: string, link: string): void;
  imageUrls(paths: string[]): Promise<Map<string, string>>;
}

type ChatRepo = Pick<MessagingRepository,
  | "listChat" | "sendChat" | "resolveChatImages" | "editChat" | "deleteChat" | "hideChat" | "reactChat" | "searchChat"
  | "listChatPresence" | "touchChatPresence" | "listConversations" | "listParticipants" | "markConversationRead"
  | "sendTyping" | "updateConversation" | "openDirectChat" | "searchPeople" | "listContacts" | "requestContact"
  | "respondContact" | "removeContact" | "blockUser" | "unblockUser" | "listBlocked">;

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const pairKey = (a: Uuid, b: Uuid) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const samePair = (c: ChatContact, a: Uuid, b: Uuid) => pairKey(c.requesterId, c.addresseeId) === pairKey(a, b);

/**
 * Datos guardados antes de la app de chat: la sala de siempre pasa a ser una
 * conversación (directa si eran dos personas), igual que en la migración.
 */
export function upgradeDemoChat(state: DemoChatState): void {
  state.chatConversations ??= [];
  state.chatParticipants ??= [];
  state.chatContacts ??= [];
  state.chatBlocks ??= [];
  state.chatReactions ??= [];
  state.chatHidden ??= [];
  const legacy = state.chat.filter((m) => !m.conversationId);
  if (legacy.length === 0) return;
  const people = [...new Set([
    ...state.chat.map((m) => m.senderId),
    ...state.chatReads.filter((r) => r.lastReadAt).map((r) => r.userId),
  ])].filter((id) => state.users.some((u) => u.id === id)).sort();
  const conversation = createConversation(state, people, people.length === 2 ? "direct" : "group", "Nuestro chat");
  for (const p of state.chatParticipants.filter((x) => x.conversationId === conversation.id)) {
    p.lastReadAt = state.chatReads.find((r) => r.userId === p.userId)?.lastReadAt ?? null;
  }
  for (const [i, a] of people.entries()) {
    for (const b of people.slice(i + 1)) {
      if (!state.chatContacts.some((c) => samePair(c, a, b))) {
        state.chatContacts.push({ id: uuid(), requesterId: a, addresseeId: b, status: "accepted", message: "", createdAt: nowIso(), respondedAt: nowIso() });
      }
    }
  }
  state.chat = state.chat.map((m) => ({
    ...m, conversationId: m.conversationId ?? conversation.id, kind: m.kind ?? "text", image: m.image ?? null,
    sticker: m.sticker ?? null, replyTo: m.replyTo ?? null, editedAt: m.editedAt ?? null, deletedAt: m.deletedAt ?? null,
    reactions: [],
  }));
  conversation.lastMessageAt = state.chat.at(-1)?.createdAt ?? null;
}

function createConversation(state: DemoChatState, people: Uuid[], kind: "direct" | "group", title = ""): DemoConversation {
  const directKey = kind === "direct" ? pairKey(people[0]!, people[1]!) : null;
  const existing = directKey ? state.chatConversations.find((c) => c.directKey === directKey) : undefined;
  const conversation = existing ?? { id: uuid(), kind, title: kind === "group" ? title : "", directKey, createdAt: nowIso(), lastMessageAt: null };
  if (!existing) state.chatConversations.push(conversation);
  for (const userId of people) {
    if (!state.chatParticipants.some((p) => p.conversationId === conversation.id && p.userId === userId)) {
      state.chatParticipants.push({
        conversationId: conversation.id, userId, joinedAt: nowIso(), lastReadAt: null, typingAt: null,
        pinnedAt: null, archivedAt: null, muted: false, clearedAt: null,
      });
    }
  }
  return conversation;
}

/** Datos de fábrica: Juan y Camila ya son contactos, y alguien le pide chatear a Juan. */
export function seedDemoChat(state: DemoChatState, juan: Uuid, camila: Uuid, guest: Uuid | undefined): void {
  upgradeDemoChat(state);
  state.chatContacts.push({ id: uuid(), requesterId: camila, addresseeId: juan, status: "accepted", message: "", createdAt: nowIso(), respondedAt: nowIso() });
  createConversation(state, [juan, camila], "direct");
  if (guest) {
    state.chatContacts.push({
      id: uuid(), requesterId: guest, addresseeId: juan, status: "pending",
      message: "¡Hola! Soy Valentina, la amiga de Cami 👋", createdAt: nowIso(), respondedAt: null,
    });
  }
}

export function createDemoChat(deps: DemoChatDeps): ChatRepo {
  const S = () => deps.state();

  const participant = (conversationId: Uuid, userId: Uuid) =>
    S().chatParticipants.find((p) => p.conversationId === conversationId && p.userId === userId);

  const isBlocked = (a: Uuid, b: Uuid) =>
    S().chatBlocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));

  const areContacts = (a: Uuid, b: Uuid) => S().chatContacts.some((c) => c.status === "accepted" && samePair(c, a, b));

  /** Mi fila en la conversación, o error si no soy parte. */
  const mine = (conversationId: Uuid) => {
    const me = deps.me();
    const row = participant(conversationId, me.id);
    if (!row) throw new AppError("Esa conversación no existe.");
    return { me, row };
  };

  const canSend = (conversationId: Uuid, userId: Uuid) => {
    const conversation = S().chatConversations.find((c) => c.id === conversationId);
    if (!conversation || !participant(conversationId, userId)) return false;
    if (conversation.kind === "group") return true;
    const other = S().chatParticipants.find((p) => p.conversationId === conversationId && p.userId !== userId)?.userId;
    return Boolean(other) && deps.canChat(other!) && areContacts(userId, other!) && !isBlocked(userId, other!);
  };

  /** ¿Lo ve esta persona? (de su chat, después de vaciarlo y sin borrar para sí) */
  const visibleTo = (m: ChatMessage, userId: Uuid) => {
    const row = participant(m.conversationId, userId);
    return Boolean(row) && (!row!.clearedAt || m.createdAt > row!.clearedAt) && !S().chatHidden.includes(`${userId}:${m.id}`);
  };

  const withReactions = (m: ChatMessage): ChatMessage => ({
    ...m,
    reactions: S().chatReactions.filter((r) => r.messageId === m.id).map(({ userId, emoji }) => ({ userId, emoji })),
    replyTo: m.replyTo
      ? (() => {
        const original = S().chat.find((x) => x.id === m.replyTo!.id);
        return original?.deletedAt ? { ...m.replyTo, body: "", deleted: true } : m.replyTo;
      })()
      : null,
  });

  const ownMessage = (id: Uuid) => {
    const me = deps.me();
    const message = S().chat.find((m) => m.id === id && m.senderId === me.id);
    if (!message) throw new AppError("Sólo puedes cambiar tus mensajes.");
    return { me, message };
  };

  const touch = (userId: Uuid, read = false) => {
    const state = S();
    const now = nowIso();
    const previous = state.chatReads.find((p) => p.userId === userId);
    const presence: ChatPresence = { userId, lastSeenAt: now, lastReadAt: read ? now : previous?.lastReadAt ?? null };
    state.chatReads = upsertPresence(state.chatReads, presence);
    deps.commit({ table: "chat_reads", type: previous ? "UPDATE" : "INSERT", record: presence as never });
  };

  const people = (id: Uuid) => S().users.find((u) => u.id === id);

  return {
    async listChat(conversationId, { before, limit = 50 } = {}) {
      const { me } = mine(conversationId);
      const all = S().chat.filter((m) => m.conversationId === conversationId && visibleTo(m, me.id) && (!before || m.createdAt < before));
      return clone(all.slice(-limit).map(withReactions));
    },
    async resolveChatImages(paths) {
      deps.me();
      return deps.imageUrls(paths);
    },
    async sendChat(conversationId, body, { replyToId = null, image, sticker } = {}) {
      const me = deps.me();
      if (!canSend(conversationId, me.id)) throw new AppError("No puedes escribir en este chat.");
      const original = replyToId ? S().chat.find((m) => m.id === replyToId) : undefined;
      if (replyToId && (!original || original.conversationId !== conversationId)) throw new AppError("El mensaje al que respondes ya no existe.");
      if (sticker && !isKnownSticker(sticker)) throw new AppError("Ese sticker no existe.");
      const text = sticker ? "" : body.trim().slice(0, 2000);
      if (!image && !sticker && !text) throw new AppError("Escribe un mensaje.");
      const recent = S().chat.filter((m) => m.senderId === me.id && Date.now() - new Date(m.createdAt).getTime() < 60_000);
      if (recent.length >= 30) throw new AppError("Vas muy rápido: espera un momentito y vuelve a intentarlo");
      const id = uuid();
      let chatImage: ChatImage | null = null;
      if (image) {
        const path = `chat/${me.id}/${id}.${image.extension}`;
        const thumbPath = `chat/${me.id}/${id}.thumb.${image.extension}`;
        await idbSet(path, image.full);
        await idbSet(thumbPath, image.thumb);
        chatImage = { path, thumbPath, width: image.width, height: image.height };
      }
      const message: ChatMessage = {
        id, conversationId, senderId: me.id, kind: image ? "image" : sticker ? "sticker" : "text", body: text,
        image: chatImage, sticker: sticker ?? null, createdAt: nowIso(), editedAt: null, deletedAt: null, reactions: [],
        replyTo: original
          ? { id: original.id, senderId: original.senderId, body: original.body, kind: original.kind ?? "text", sticker: original.sticker ?? null }
          : null,
      };
      // Tras subir la foto se releen los datos por si otra pestaña escribió.
      const state = S();
      state.chat.push(message);
      state.chat = state.chat.slice(-2000);
      const conversation = state.chatConversations.find((c) => c.id === conversationId)!;
      conversation.lastMessageAt = message.createdAt;
      const myRow = participant(conversationId, me.id)!;
      myRow.typingAt = null;
      myRow.lastReadAt = message.createdAt;
      deps.commit({ table: "chat_messages", type: "INSERT", record: message as never });
      deps.commit({ table: "chat_participants", type: "UPDATE", record: myRow as never });
      // Un aviso sin leer por conversación, que se actualiza con el último mensaje.
      const link = `/chat/${conversationId}`;
      const title = conversation.kind === "group" && conversation.title
        ? `${me.displayName} en ${conversation.title} 💬`
        : `${me.displayName} te escribió 💬`;
      const preview = messagePreview(message, 140);
      for (const p of state.chatParticipants.filter((x) => x.conversationId === conversationId && x.userId !== me.id)) {
        if (p.muted || !deps.canChat(p.userId) || isBlocked(p.userId, me.id)) continue;
        const unread = state.notifications.find((n) => n.userId === p.userId && n.kind === "chat" && !n.readAt && n.link === link);
        if (unread) {
          Object.assign(unread, { title, body: preview, createdAt: nowIso() });
          deps.commit({ table: "notifications", type: "UPDATE", record: unread as never });
        } else {
          deps.notify(p.userId, "chat", title, preview, link);
        }
      }
      return clone(message);
    },
    async editChat(id, body) {
      const { me, message } = ownMessage(id);
      if (message.deletedAt || message.kind === "sticker") throw new AppError("Ese mensaje no se puede editar.");
      if (!canSend(message.conversationId, me.id)) throw new AppError("No puedes escribir en este chat.");
      if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) throw new AppError("Sólo se puede editar durante los primeros 15 minutos.");
      const text = body.trim();
      if (text.length > 2000 || (message.kind === "text" && !text)) throw new AppError("Escribe un mensaje (hasta 2000 caracteres).");
      if (text === message.body) return;
      Object.assign(message, { body: text, editedAt: nowIso() });
      deps.commit({ table: "chat_messages", type: "UPDATE", record: message as never });
    },
    async deleteChat(id) {
      const { message } = ownMessage(id);
      if (message.deletedAt) return;
      const paths = message.image ? [message.image.path, message.image.thumbPath] : [];
      Object.assign(message, { body: "", image: null, sticker: null, deletedAt: nowIso() });
      S().chatReactions = S().chatReactions.filter((r) => r.messageId !== id);
      deps.commit({ table: "chat_messages", type: "UPDATE", record: message as never });
      await Promise.all(paths.map((p) => idbDel(p)));
    },
    async hideChat(id) {
      const me = deps.me();
      const message = S().chat.find((m) => m.id === id);
      if (!message || !visibleTo(message, me.id)) throw new AppError("Ese mensaje no existe.");
      S().chatHidden.push(`${me.id}:${id}`);
      deps.commit({ table: "chat_hidden_messages", type: "INSERT", record: { user_id: me.id, message_id: id } as never });
    },
    async reactChat(id, emoji) {
      const me = deps.me();
      const message = S().chat.find((m) => m.id === id);
      if (!message || !visibleTo(message, me.id) || message.deletedAt) throw new AppError("Ese mensaje no existe.");
      const state = S();
      const previous = state.chatReactions.find((r) => r.messageId === id && r.userId === me.id);
      state.chatReactions = state.chatReactions.filter((r) => !(r.messageId === id && r.userId === me.id));
      if (emoji !== null) {
        if (!(REACTIONS as readonly string[]).includes(emoji)) throw new AppError("Esa reacción no existe.");
        if (!canSend(message.conversationId, me.id)) throw new AppError("No puedes escribir en este chat.");
        state.chatReactions.push({ messageId: id, userId: me.id, emoji, createdAt: nowIso() });
      }
      const record = { message_id: id, user_id: me.id, emoji };
      deps.commit(emoji === null
        ? { table: "chat_reactions", type: "DELETE", record: null, old: record as never }
        : { table: "chat_reactions", type: previous ? "UPDATE" : "INSERT", record: record as never });
    },
    async searchChat(conversationId, query) {
      const { me } = mine(conversationId);
      const q = query.trim().toLowerCase();
      if (q.length < 2) return [];
      return clone(S().chat
        .filter((m) => m.conversationId === conversationId && !m.deletedAt && visibleTo(m, me.id) && m.body.toLowerCase().includes(q))
        .reverse().slice(0, 50).map(withReactions));
    },
    async listChatPresence() {
      const me = deps.me();
      const shared = new Set(S().chatParticipants
        .filter((p) => S().chatParticipants.some((x) => x.userId === me.id && x.conversationId === p.conversationId))
        .map((p) => p.userId));
      return clone(S().chatReads.filter((r) => r.userId === me.id || shared.has(r.userId)));
    },
    async touchChatPresence({ read = false } = {}) {
      touch(deps.me().id, read);
    },

    async listConversations() {
      const me = deps.me();
      const state = S();
      return state.chatParticipants.filter((p) => p.userId === me.id).map((row): ChatConversation => {
        const c = state.chatConversations.find((x) => x.id === row.conversationId)!;
        const visible = state.chat.filter((m) => m.conversationId === c.id && visibleTo(m, me.id));
        const last = visible.at(-1);
        return {
          id: c.id, kind: c.kind, title: c.title, createdAt: c.createdAt, lastMessageAt: c.lastMessageAt,
          participantIds: state.chatParticipants.filter((p) => p.conversationId === c.id).map((p) => p.userId),
          pinnedAt: row.pinnedAt, archivedAt: row.archivedAt, muted: row.muted, lastReadAt: row.lastReadAt,
          unread: visible.filter((m) => m.senderId !== me.id && !m.deletedAt && (!row.lastReadAt || m.createdAt > row.lastReadAt)).length,
          lastMessage: last
            ? { id: last.id, senderId: last.senderId, kind: last.kind, body: last.body, sticker: last.sticker, createdAt: last.createdAt, deleted: Boolean(last.deletedAt) }
            : null,
        };
      });
    },
    async listParticipants(conversationId) {
      mine(conversationId);
      return clone(S().chatParticipants.filter((p) => p.conversationId === conversationId)
        .map(({ conversationId: c, userId, lastReadAt, typingAt }) => ({ conversationId: c, userId, lastReadAt, typingAt })));
    },
    async markConversationRead(conversationId) {
      const { me, row } = mine(conversationId);
      row.lastReadAt = nowIso();
      deps.commit({ table: "chat_participants", type: "UPDATE", record: row as never });
      const link = `/chat/${conversationId}`;
      const unread = S().notifications.filter((n) => n.userId === me.id && n.kind === "chat" && !n.readAt && n.link === link);
      if (unread.length) {
        unread.forEach((n) => (n.readAt = nowIso()));
        deps.commit({ table: "notifications", type: "UPDATE", record: null });
      }
      touch(me.id);
    },
    async sendTyping(conversationId) {
      const me = deps.me();
      const row = participant(conversationId, me.id);
      if (!row || !canSend(conversationId, me.id)) return;
      row.typingAt = nowIso();
      deps.commit({ table: "chat_participants", type: "UPDATE", record: row as never });
    },
    async updateConversation(conversationId, { pinned, archived, muted, clear }) {
      const { row } = mine(conversationId);
      if (pinned !== undefined) row.pinnedAt = pinned ? row.pinnedAt ?? nowIso() : null;
      if (archived !== undefined) row.archivedAt = archived ? row.archivedAt ?? nowIso() : null;
      if (muted !== undefined) row.muted = muted;
      if (clear) row.clearedAt = nowIso();
      deps.commit({ table: "chat_participants", type: "UPDATE", record: row as never });
    },
    async openDirectChat(userId) {
      const me = deps.me();
      if (!areContacts(me.id, userId)) throw new AppError("Primero tienen que aceptarse como contactos.");
      const conversation = createConversation(S(), [me.id, userId], "direct");
      deps.commit({ table: "chat_participants", type: "INSERT", record: null });
      return conversation.id;
    },

    async searchPeople(query) {
      const me = deps.me();
      const q = query.trim().toLowerCase();
      const state = S();
      return state.users
        .filter((u) => u.id !== me.id && deps.canChat(u.id) && !state.chatBlocks.some((b) => b.blockerId === u.id && b.blockedId === me.id))
        .filter((u) => !q || u.displayName.toLowerCase().includes(q))
        .map((u): ChatPerson => {
          const contact = state.chatContacts.find((c) => samePair(c, me.id, u.id));
          const blocked = state.chatBlocks.some((b) => b.blockerId === me.id && b.blockedId === u.id);
          return {
            id: u.id, displayName: u.displayName, avatarPath: u.avatarPath ?? null, avatarEmoji: u.avatarEmoji ?? null, bio: u.bio ?? "",
            relation: blocked ? "blocked" : contact?.status === "accepted" ? "contact" : contact ? (contact.requesterId === me.id ? "outgoing" : "incoming") : "none",
            contactId: contact?.id ?? null,
          };
        })
        .sort((a, b) => Number(b.relation === "contact") - Number(a.relation === "contact") || a.displayName.localeCompare(b.displayName))
        .slice(0, 30);
    },
    async listContacts() {
      const me = deps.me();
      return clone(S().chatContacts.filter((c) => c.requesterId === me.id || c.addresseeId === me.id));
    },
    async requestContact(userId, message = "") {
      const me = deps.me();
      if (userId === me.id) throw new AppError("No puedes enviarte una solicitud a ti.");
      if (!people(userId) || !deps.canChat(userId)) throw new AppError("Esa persona no está disponible en el chat.");
      if (isBlocked(me.id, userId)) throw new AppError("No puedes enviarle una solicitud a esta persona.");
      const state = S();
      const existing = state.chatContacts.find((c) => samePair(c, me.id, userId));
      if (existing?.status === "accepted") return "accepted";
      if (existing?.requesterId === me.id) return "pending";
      if (existing) {
        const conversation = createConversation(state, [existing.requesterId, me.id], "direct");
        Object.assign(existing, { status: "accepted", respondedAt: nowIso() });
        deps.commit({ table: "chat_contacts", type: "UPDATE", record: existing as never });
        deps.notify(existing.requesterId, "chat", `${me.displayName} aceptó tu solicitud 🎉`, "Ya pueden chatear", `/chat/${conversation.id}`);
        return "accepted";
      }
      const recent = state.chatContacts.filter((c) => c.requesterId === me.id && Date.now() - new Date(c.createdAt).getTime() < 3_600_000);
      if (recent.length >= 20) throw new AppError("Vas muy rápido: espera un momentito y vuelve a intentarlo");
      const contact: ChatContact = {
        id: uuid(), requesterId: me.id, addresseeId: userId, status: "pending",
        message: message.trim().slice(0, 200), createdAt: nowIso(), respondedAt: null,
      };
      state.chatContacts.push(contact);
      deps.commit({ table: "chat_contacts", type: "INSERT", record: contact as never });
      deps.notify(userId, "chat", `${me.displayName} quiere chatear contigo 👋`, contact.message || "Toca para ver la solicitud", "/chat/solicitudes");
      return "pending";
    },
    async respondContact(contactId, accept) {
      const me = deps.me();
      const state = S();
      const contact = state.chatContacts.find((c) => c.id === contactId && c.addresseeId === me.id && c.status === "pending");
      if (!contact) throw new AppError("Esa solicitud ya no está pendiente.");
      if (!accept) {
        state.chatContacts = state.chatContacts.filter((c) => c.id !== contactId);
        deps.commit({ table: "chat_contacts", type: "DELETE", record: null, old: { id: contactId } });
        return null;
      }
      const conversation = createConversation(state, [contact.requesterId, me.id], "direct");
      Object.assign(contact, { status: "accepted", respondedAt: nowIso() });
      deps.commit({ table: "chat_contacts", type: "UPDATE", record: contact as never });
      deps.notify(contact.requesterId, "chat", `${me.displayName} aceptó tu solicitud 🎉`, "Ya pueden chatear", `/chat/${conversation.id}`);
      return conversation.id;
    },
    async removeContact(userId) {
      const me = deps.me();
      const state = S();
      const gone = state.chatContacts.filter((c) => samePair(c, me.id, userId));
      state.chatContacts = state.chatContacts.filter((c) => !samePair(c, me.id, userId));
      for (const c of gone) deps.commit({ table: "chat_contacts", type: "DELETE", record: null, old: { id: c.id } });
    },
    async blockUser(userId) {
      const me = deps.me();
      if (userId === me.id) throw new AppError("No puedes bloquearte a ti.");
      const state = S();
      if (!state.chatBlocks.some((b) => b.blockerId === me.id && b.blockedId === userId)) state.chatBlocks.push({ blockerId: me.id, blockedId: userId });
      state.chatContacts = state.chatContacts.filter((c) => !samePair(c, me.id, userId));
      deps.commit({ table: "chat_contacts", type: "DELETE", record: null });
    },
    async unblockUser(userId) {
      const me = deps.me();
      S().chatBlocks = S().chatBlocks.filter((b) => !(b.blockerId === me.id && b.blockedId === userId));
      deps.commit({ table: "chat_contacts", type: "UPDATE", record: null });
    },
    async listBlocked() {
      const me = deps.me();
      return S().chatBlocks.filter((b) => b.blockerId === me.id).map((b) => b.blockedId);
    },
  };
}
