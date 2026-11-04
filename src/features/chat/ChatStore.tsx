/**
 * Estado compartido de la app de chat: bandeja, contactos y solicitudes,
 * perfiles, conexiones y «escribiendo…». Se mantiene al día en tiempo real
 * y lo usan la lista de chats, el buscador y cada conversación.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { otherParticipant, upsertPresence } from "@/domain/chat";
import type { ChatContact, ChatConversation, ChatPresence, Profile, Uuid } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { msg, useLocale } from "@/i18n";

/** Cada cuánto se refrescan los textos de «hace 3 min». */
const CLOCK_MS = 20_000;
/** Varios cambios seguidos se juntan en una sola recarga. */
const RELOAD_DEBOUNCE_MS = 250;

type Row = Record<string, unknown>;

export interface ChatStore {
  ready: boolean;
  me: Uuid | null;
  now: Date;
  conversations: ChatConversation[];
  contacts: ChatContact[];
  blocked: Uuid[];
  profiles: Map<Uuid, Profile>;
  presences: ChatPresence[];
  /** conversationId → userId → última tecla. */
  typing: Map<Uuid, Map<Uuid, string>>;
  incoming: ChatContact[];
  outgoing: ChatContact[];
  /** Total de mensajes sin leer (sin contar los chats silenciados). */
  unreadTotal: number;
  reload(): Promise<void>;
  /** Nombre de una persona («Tú» si soy yo). */
  nameOf(id: Uuid | null | undefined): string;
  /** Nombre que se muestra para una conversación. */
  titleOf(conversation: ChatConversation): string;
  /** La otra persona de un chat directo. */
  peerOf(conversation: ChatConversation): Profile | null;
  isContact(userId: Uuid): boolean;
  /** Cambia algo de una conversación en la bandeja sin esperar al servidor. */
  patchConversation(id: Uuid, patch: Partial<ChatConversation>): void;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { user } = useAuth();
  const toast = useToast();
  const me = user?.id ?? null;
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [blocked, setBlocked] = useState<Uuid[]>([]);
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [presences, setPresences] = useState<ChatPresence[]>([]);
  const [typing, setTyping] = useState<Map<Uuid, Map<Uuid, string>>>(() => new Map());
  const [now, setNow] = useState(() => new Date());

  const reload = useCallback(async () => {
    try {
      const [inbox, mine, blocks, people, seen] = await Promise.all([
        backend.messaging.listConversations(),
        backend.messaging.listContacts(),
        backend.messaging.listBlocked(),
        backend.users.listProfiles(),
        backend.messaging.listChatPresence(),
      ]);
      setConversations(inbox);
      setContacts(mine);
      setBlocked(blocks);
      setProfileList(people);
      setPresences(seen);
    } catch (error) {
      toast.error(error);
    } finally {
      setReady(true);
    }
  }, [backend, toast]);

  // Los cambios llegan en ráfagas (un mensaje toca varias tablas): una recarga.
  const timer = useRef<number | undefined>(undefined);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void reload(), RELOAD_DEBOUNCE_MS);
  }, [reload]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => backend.realtime.subscribe(
    ["chat_messages", "chat_participants", "chat_contacts", "chat_reads", "chat_hidden_messages"],
    (change) => {
      const r = change.record as Row | null;
      if (change.table === "chat_reads") {
        if (r) {
          setPresences((list) => upsertPresence(list, {
            userId: String(r.user_id ?? r.userId),
            lastSeenAt: String(r.last_seen_at ?? r.lastSeenAt),
            lastReadAt: (r.last_read_at ?? r.lastReadAt ?? null) as string | null,
          }));
        }
        return;
      }
      if (change.table === "chat_participants" && r) {
        const conversationId = String(r.conversation_id ?? r.conversationId ?? "");
        const userId = String(r.user_id ?? r.userId ?? "");
        const typingAt = (r.typing_at ?? r.typingAt ?? null) as string | null;
        if (conversationId && userId && userId !== me) {
          setTyping((current) => {
            const next = new Map(current);
            const people = new Map(next.get(conversationId) ?? []);
            if (typingAt) people.set(userId, typingAt);
            else people.delete(userId);
            next.set(conversationId, people);
            return next;
          });
        }
        // Un latido de «escribiendo…» no cambia la bandeja.
        if (!typingAt || userId === me) scheduleReload();
        return;
      }
      if (change.table === "chat_messages" && r && change.type === "INSERT") {
        // Quien envía deja de estar «escribiendo…».
        const conversationId = String(r.conversation_id ?? r.conversationId ?? "");
        const senderId = String(r.sender_id ?? r.senderId ?? "");
        setTyping((current) => {
          if (!current.get(conversationId)?.has(senderId)) return current;
          const next = new Map(current);
          const people = new Map(next.get(conversationId));
          people.delete(senderId);
          next.set(conversationId, people);
          return next;
        });
      }
      scheduleReload();
    },
  ), [backend, me, scheduleReload]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), CLOCK_MS);
    // Al volver a la app se pone al día por si se perdió algún evento.
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [scheduleReload]);

  const patchConversation = useCallback((id: Uuid, patch: Partial<ChatConversation>) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const locale = useLocale();
  const value = useMemo<ChatStore>(() => {
    const profiles = new Map(profileList.map((p) => [p.id, p]));
    const t = msg();
    const nameOf = (id: Uuid | null | undefined) => (id && id === me ? t.chat.you : (id && profiles.get(id)?.displayName) || t.common.someone);
    const peerOf = (c: ChatConversation) => {
      const other = otherParticipant(c, me);
      return other ? profiles.get(other) ?? null : null;
    };
    const titleOf = (c: ChatConversation) => {
      if (c.kind === "group") return c.title || c.participantIds.filter((id) => id !== me).map(nameOf).join(", ") || t.chat.group;
      return peerOf(c)?.displayName || t.common.someone;
    };
    const incoming = contacts.filter((c) => c.status === "pending" && c.addresseeId === me);
    const outgoing = contacts.filter((c) => c.status === "pending" && c.requesterId === me);
    return {
      ready, me, now, conversations, contacts, blocked, profiles, presences, typing, incoming, outgoing,
      unreadTotal: conversations.filter((c) => !c.muted).reduce((sum, c) => sum + c.unread, 0),
      reload, nameOf, titleOf, peerOf, patchConversation,
      isContact: (userId) => contacts.some((c) => c.status === "accepted" && (c.requesterId === userId || c.addresseeId === userId)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el idioma cambia los textos de nameOf/titleOf.
  }, [ready, me, now, conversations, contacts, blocked, profileList, presences, typing, reload, patchConversation, locale]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatStore {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat debe usarse dentro de <ChatProvider>");
  return ctx;
}
