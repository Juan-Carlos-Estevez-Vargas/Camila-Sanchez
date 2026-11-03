import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type FormEvent, type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ChatSendOptions } from "@/data/ports";
import {
  canEditMessage, conversationPresences, DELETED_LABEL, groupReactions, isTyping, lastSeenLabel, messagePreview, quoteSnippet,
  REACTIONS, readersOf, receiptOf, toggleReaction, TYPING_THROTTLE_MS, upsertParticipant, type Receipt,
} from "@/domain/chat";
import type {
  ChatConversation, ChatImage, ChatKind, ChatMessage, ChatParticipant, ChatReaction, ChatReplyPreview,
} from "@/domain/types";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { ProfileCard } from "@/features/auth/ProfileCard";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar } from "@/ui/Avatar";
import { PageLoader } from "@/ui/Feedback";
import { Modal } from "@/ui/Modal";
import { prefersReducedMotion } from "@/ui/motion";
import { useConfirm } from "@/ui/useConfirm";
import { useChat } from "./ChatStore";
import { Menu, type MenuItem } from "./Menu";
import { StickerArt } from "./StickerArt";
import { StickerPicker } from "./StickerPicker";

const PAGE = 40;
/** Distancia (px) que hay que deslizar un mensaje para responderlo. */
const SWIPE_TO_REPLY = 56;
/** Mantener pulsado un mensaje (ms) abre sus opciones. */
const LONG_PRESS_MS = 450;
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const fullFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" });
/** Fotos por envío, como en WhatsApp sin llegar a saturar. */
const MAX_PHOTOS = 10;
/** Las fotos del chat se ven en el celular: más livianas que las del álbum. */
const CHAT_IMAGE_OPTIONS = { maxEdge: 1600, thumbEdge: 480, quality: 0.82, targetBytes: 350 * 1024, minQuality: 0.66 };

interface Pending extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
  /** Vista previa local de una foto que todavía se está subiendo. */
  localUrl?: string;
}

/** Foto elegida que aún no se envía. */
interface Draft {
  id: string;
  file: File;
  url: string;
}

type Row = Record<string, unknown>;

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

/** Inserta o reemplaza por id manteniendo orden cronológico (sin duplicados). */
function merge(list: Pending[], incoming: Pending[]): Pending[] {
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Mensaje recibido en tiempo real (filas de Supabase o del modo demo). */
function messageFromRecord(r: Row, known: Pending[]): ChatMessage {
  const embedded = r.replyTo as ChatReplyPreview | null | undefined;
  const replyId = (r.reply_to as string | null | undefined) ?? embedded?.id ?? null;
  const original = replyId ? known.find((m) => m.id === replyId) : undefined;
  const imagePath = (r.image_path as string | null | undefined) ?? null;
  const id = String(r.id);
  const previous = known.find((m) => m.id === id);
  return {
    id,
    conversationId: String(r.conversation_id ?? r.conversationId),
    senderId: String(r.sender_id ?? r.senderId),
    kind: (r.kind as ChatKind | undefined) ?? "text",
    body: String(r.body ?? ""),
    image: r.image !== undefined ? (r.image as ChatImage | null) : imagePath
      ? {
        path: imagePath,
        thumbPath: String(r.thumb_path ?? imagePath),
        width: (r.image_width as number | null) ?? null,
        height: (r.image_height as number | null) ?? null,
      }
      : null,
    sticker: (r.sticker as string | null | undefined) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    editedAt: (r.edited_at ?? r.editedAt ?? null) as string | null,
    deletedAt: (r.deleted_at ?? r.deletedAt ?? null) as string | null,
    // Las reacciones llegan aparte (chat_reactions); se conservan las que había.
    reactions: (r.reactions as ChatReaction[] | undefined) ?? previous?.reactions ?? [],
    replyTo: embedded ?? previous?.replyTo ?? (replyId
      ? {
        id: replyId,
        senderId: original?.senderId ?? "",
        body: original?.body ?? "Mensaje anterior",
        kind: original?.kind ?? "text",
        sticker: original?.sticker ?? null,
        deleted: Boolean(original?.deletedAt),
      }
      : null),
  };
}

const RECEIPT_LABEL: Record<Receipt, string> = {
  sending: "Enviando",
  failed: "No enviado",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Visto",
};

function ReceiptMark({ receipt, readers }: { receipt: Receipt; readers: string }) {
  const label = receipt === "read" && readers ? `Visto por ${readers}` : RECEIPT_LABEL[receipt];
  const icon = receipt === "sending" ? "🕓" : receipt === "failed" ? "!" : receipt === "sent" ? "✓" : "✓✓";
  return (
    <span className={`receipt receipt--${receipt}`} title={label} aria-label={label} role="img">
      {icon}
    </span>
  );
}

export function ConversationView({ conversation }: { conversation: ChatConversation }) {
  const backend = useBackend();
  const chat = useChat();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const me = chat.me;
  const conversationId = conversation.id;
  const peer = chat.peerOf(conversation);
  const isGroup = conversation.kind === "group";
  const title = chat.titleOf(conversation);

  const [messages, setMessages] = useState<Pending[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [picker, setPicker] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(() => new Map());
  const [viewing, setViewing] = useState<Pending | null>(null);
  const [info, setInfo] = useState<Pending | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [searching, setSearching] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [missed, setMissed] = useState(0);
  // Dónde empezaba lo no leído al abrir el chat (para la franja «sin leer»).
  const [unreadFrom] = useState(() => conversation.unread > 0 ? conversation.lastReadAt ?? "" : null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);
  const lastTyping = useRef(0);
  const processor = useMemo(() => new ImageProcessor(CHAT_IMAGE_OPTIONS), []);

  useEffect(() => () => processor.dispose(), [processor]);

  const blockedByMe = peer ? chat.blocked.includes(peer.id) : false;
  const canSend = isGroup || (peer !== null && peer.isActive && chat.isContact(peer.id) && !blockedByMe);

  // Miniaturas firmadas de las fotos que aún no tienen URL.
  useEffect(() => {
    const missing = messages
      .flatMap((m) => (m.image && !m.localUrl ? [m.image.thumbPath] : []))
      .filter((path) => !imageUrls.has(path));
    if (missing.length === 0) return;
    let active = true;
    backend.messaging.resolveChatImages(missing)
      .then((urls) => active && setImageUrls((current) => new Map([...current, ...urls])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [messages, imageUrls, backend]);

  // La foto grande sólo se pide al abrirla.
  useEffect(() => {
    const path = viewing?.image?.path;
    if (!path || imageUrls.has(path)) return;
    backend.messaging.resolveChatImages([path])
      .then((urls) => setImageUrls((current) => new Map([...current, ...urls])))
      .catch((error) => toast.error(error));
  }, [viewing, imageUrls, backend, toast]);

  // Las vistas previas locales se liberan al salir.
  const draftsRef = useRef<Draft[]>([]);
  draftsRef.current = drafts;
  useEffect(() => () => draftsRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      backend.messaging.listChat(conversationId, { limit: PAGE }),
      backend.messaging.listParticipants(conversationId),
    ])
      .then(([msgs, people]) => {
        if (!active) return;
        setMessages(msgs);
        setHasMore(msgs.length === PAGE);
        setParticipants(people);
      })
      .catch((error) => toast.error(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [backend, toast, conversationId]);

  // Mensajes, ediciones, reacciones, vistos y «escribiendo…» en tiempo real.
  useEffect(() => backend.realtime.subscribe(
    ["chat_messages", "chat_participants", "chat_reactions", "chat_hidden_messages"],
    (change) => {
      const r = change.record as Row | null;
      const old = change.old as Row | null;
      if (change.table === "chat_participants") {
        if (r && String(r.conversation_id ?? r.conversationId) === conversationId) {
          setParticipants((list) => upsertParticipant(list, {
            conversationId,
            userId: String(r.user_id ?? r.userId),
            lastReadAt: (r.last_read_at ?? r.lastReadAt ?? null) as string | null,
            typingAt: (r.typing_at ?? r.typingAt ?? null) as string | null,
          }));
        }
        return;
      }
      if (change.table === "chat_reactions") {
        const row = r ?? old;
        if (!row) return;
        const messageId = String(row.message_id ?? row.messageId);
        const userId = String(row.user_id ?? row.userId);
        setMessages((list) => list.map((m) => {
          if (m.id !== messageId) return m;
          const others = m.reactions.filter((x) => x.userId !== userId);
          return { ...m, reactions: change.type === "DELETE" || !r ? others : [...others, { userId, emoji: String(r.emoji) }] };
        }));
        return;
      }
      if (change.table === "chat_hidden_messages") {
        if (r && String(r.user_id ?? r.userId) === me) {
          const id = String(r.message_id ?? r.messageId);
          setMessages((list) => list.filter((m) => m.id !== id));
        }
        return;
      }
      if (!r || String(r.conversation_id ?? r.conversationId) !== conversationId) return;
      if (change.type === "INSERT") {
        setMessages((list) => merge(list, [messageFromRecord(r, list)]));
        if (!stickToBottom.current && String(r.sender_id ?? r.senderId) !== me) setMissed((n) => n + 1);
      } else if (change.type === "UPDATE") {
        const id = String(r.id);
        setMessages((list) => list
          .map((m) => (m.id === id ? { ...m, ...messageFromRecord(r, list) } : m))
          // Si se borró para todos, las citas a ese mensaje lo dicen.
          .map((m) => (m.replyTo?.id === id && r.deleted_at ? { ...m, replyTo: { ...m.replyTo, body: "", deleted: true } } : m)));
      }
    },
  ), [backend, conversationId, me]);

  // Mientras el chat está a la vista, lo que llega se da por leído.
  const lastIncoming = [...messages].reverse().find((m) => m.senderId !== me && !m.pending)?.id;
  useEffect(() => {
    const markRead = () => {
      if (document.visibilityState !== "visible") return;
      chat.patchConversation(conversationId, { unread: 0 });
      void backend.messaging.markConversationRead(conversationId).catch(() => undefined);
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
    // chat cambia con cada recarga: sólo interesa al llegar algo nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIncoming, backend, conversationId]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || loading) return;
    if (stickToBottom.current) {
      // Al abrir con mensajes sin leer, se empieza por el primero sin leer.
      const divider = el.querySelector<HTMLElement>("[data-unread-divider]");
      if (divider && !el.dataset.opened) {
        divider.scrollIntoView({ block: "start" });
        stickToBottom.current = false;
        setAtBottom(false);
      } else {
        el.scrollTop = el.scrollHeight;
      }
      el.dataset.opened = "1";
    }
  }, [messages, loading]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = bottom;
    setAtBottom(bottom);
    if (bottom) setMissed(0);
  };

  const scrollToBottom = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setMissed(0);
  };

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return [];
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    stickToBottom.current = false;
    const older = await backend.messaging.listChat(conversationId, { before: first.createdAt, limit: PAGE });
    setHasMore(older.length === PAGE);
    setMessages((list) => merge(list, older));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
    return older;
  }, [backend, messages, conversationId]);

  const focusInput = () => requestAnimationFrame(() => input.current?.focus());

  const startReply = (message: ChatMessage) => {
    setEditing(null);
    setReplyingTo(message);
    focusInput();
  };

  const startEdit = (message: ChatMessage) => {
    setReplyingTo(null);
    setDrafts([]);
    setEditing(message);
    setText(message.body);
    focusInput();
  };

  const cancelEdit = () => {
    setEditing(null);
    setText("");
  };

  /** Lleva a un mensaje (cargando los anteriores si hace falta) y lo resalta. */
  const jumpTo = async (id: string, createdAt?: string) => {
    let target = document.getElementById(`msg-${id}`);
    if (!target && createdAt) {
      // Se cargan páginas anteriores hasta llegar a ese mensaje.
      let oldest = messages[0]?.createdAt;
      for (let i = 0; i < 25 && oldest && oldest > createdAt; i++) {
        const older = await backend.messaging.listChat(conversationId, { before: oldest, limit: PAGE });
        if (older.length === 0) break;
        stickToBottom.current = false;
        setMessages((list) => merge(list, older));
        setHasMore(older.length === PAGE);
        oldest = older[0]!.createdAt;
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      target = document.getElementById(`msg-${id}`);
    }
    if (!target) {
      toast.show({ title: "Ese mensaje ya no está", body: "Puede que se haya borrado o que vaciaras el chat." });
      return;
    }
    stickToBottom.current = false;
    target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    // El foco también va al mensaje, para que el teclado y el lector sigan ahí.
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    setFlash(id);
    window.setTimeout(() => setFlash((current) => (current === id ? null : current)), 1600);
  };

  /** Muestra el mensaje al instante y lo confirma (o lo marca fallido) al volver del servidor. */
  const deliver = async (temp: Pending, body: string, options: ChatSendOptions) => {
    stickToBottom.current = true;
    setMessages((list) => merge(list, [temp]));
    try {
      const saved = await backend.messaging.sendChat(conversationId, body, options);
      if (temp.localUrl && saved.image) {
        // La miniatura ya está en el navegador: se reutiliza mientras llega la firmada.
        setImageUrls((current) => new Map(current).set(saved.image!.thumbPath, temp.localUrl!));
      }
      setMessages((list) => merge(list.filter((m) => m.id !== temp.id), [saved]));
    } catch (error) {
      setMessages((list) => list.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      toast.error(error, "No se envió");
    }
  };

  const draftMessage = (quoted: ChatMessage | null, patch: Partial<Pending>): Pending => ({
    id: `tmp-${crypto.randomUUID()}`, conversationId, senderId: me!, kind: "text", body: "", image: null, sticker: null,
    createdAt: new Date().toISOString(), pending: true, editedAt: null, deletedAt: null, reactions: [],
    replyTo: quoted ? { id: quoted.id, senderId: quoted.senderId, body: quoted.body, kind: quoted.kind, sticker: quoted.sticker } : null,
    ...patch,
  });

  const saveEdit = async () => {
    const message = editing;
    const body = text.trim();
    if (!message) return;
    if (message.kind === "text" && !body) return;
    setEditing(null);
    setText("");
    if (body === message.body) return;
    const before = messages.find((m) => m.id === message.id);
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, body, editedAt: new Date().toISOString() } : m)));
    try {
      await backend.messaging.editChat(message.id, body);
    } catch (error) {
      if (before) setMessages((list) => list.map((m) => (m.id === message.id ? before : m)));
      toast.error(error, "No se editó");
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (editing) {
      await saveEdit();
      return;
    }
    const body = text.trim();
    if ((!body && drafts.length === 0) || !me) return;
    const quoted = replyingTo;
    const photos = drafts;
    setText("");
    setReplyingTo(null);
    setDrafts([]);
    if (photos.length === 0) {
      await deliver(draftMessage(quoted, { body }), body, { replyToId: quoted?.id ?? null });
      return;
    }
    // Una foto por mensaje; el texto va de pie en la primera y la cita también.
    for (const [index, photo] of photos.entries()) {
      const caption = index === 0 ? body : "";
      const temp = draftMessage(index === 0 ? quoted : null, { kind: "image", body: caption, localUrl: photo.url });
      setMessages((list) => merge(list, [temp]));
      stickToBottom.current = true;
      try {
        const optimized = await processor.process(photo.file);
        await deliver(temp, caption, {
          replyToId: index === 0 ? quoted?.id ?? null : null,
          image: { full: optimized.full, thumb: optimized.thumb, extension: optimized.extension, width: optimized.width, height: optimized.height },
        });
      } catch (error) {
        setMessages((list) => list.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
        toast.error(error, "No se envió la foto");
      }
    }
  };

  const retry = (m: Pending) => {
    if (m.kind !== "text") {
      toast.show({ title: "Vuelve a elegir la foto", body: "Las fotos que no se enviaron hay que elegirlas otra vez." });
      return;
    }
    setMessages((list) => list.filter((x) => x.id !== m.id));
    void deliver({ ...m, id: `tmp-${crypto.randomUUID()}`, pending: true, failed: false, createdAt: new Date().toISOString() }, m.body, { replyToId: m.replyTo?.id ?? null });
  };

  const sendSticker = (id: string) => {
    if (!me) return;
    setPicker(false);
    const quoted = replyingTo;
    setReplyingTo(null);
    void deliver(draftMessage(quoted, { kind: "sticker", sticker: id }), "", { replyToId: quoted?.id ?? null, sticker: id });
    input.current?.focus();
  };

  const addPhotos = (files: Iterable<File>) => {
    const images = [...files].filter(isImageFile);
    if (images.length === 0) {
      toast.show({ title: "Eso no es una foto", body: "Elige imágenes JPG, PNG, WebP o HEIC.", tone: "error" });
      return;
    }
    setDrafts((current) => {
      const room = MAX_PHOTOS - current.length;
      if (images.length > room) toast.show({ title: `Máximo ${MAX_PHOTOS} fotos por envío` });
      return [...current, ...images.slice(0, Math.max(room, 0)).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))];
    });
    input.current?.focus();
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => {
      const draft = current.find((d) => d.id === id);
      if (draft) URL.revokeObjectURL(draft.url);
      return current.filter((d) => d.id !== id);
    });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files].filter(isImageFile);
    if (files.length && !editing) {
      e.preventDefault();
      addPhotos(files);
    }
  };

  const onType = (value: string) => {
    setText(value);
    if (!value.trim() || editing) return;
    const now = Date.now();
    if (now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now;
      void backend.messaging.sendTyping(conversationId).catch(() => undefined);
    }
  };

  const react = async (message: Pending, emoji: string) => {
    if (!me) return;
    const before = message.reactions;
    const { next, emoji: value } = toggleReaction(before, me, emoji);
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, reactions: next } : m)));
    try {
      await backend.messaging.reactChat(message.id, value);
    } catch (error) {
      setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, reactions: before } : m)));
      toast.error(error, "No se guardó la reacción");
    }
  };

  const copy = async (message: Pending) => {
    try {
      await navigator.clipboard.writeText(message.body);
      toast.show({ title: "Mensaje copiado", tone: "success", durationMs: 2000 });
    } catch {
      toast.show({ title: "No se pudo copiar", tone: "error" });
    }
  };

  const removeForMe = async (message: Pending) => {
    if (message.failed || message.pending) {
      setMessages((list) => list.filter((m) => m.id !== message.id));
      return;
    }
    if (!(await confirm({ title: "¿Eliminar para ti?", body: "Dejarás de verlo; los demás lo siguen viendo.", confirmLabel: "Eliminar para mí", danger: true }))) return;
    setMessages((list) => list.filter((m) => m.id !== message.id));
    try {
      await backend.messaging.hideChat(message.id);
    } catch (error) {
      setMessages((list) => merge(list, [message]));
      toast.error(error);
    }
  };

  const removeForAll = async (message: Pending) => {
    if (!(await confirm({ title: "¿Eliminar para todos?", body: "Nadie podrá verlo; quedará «Se eliminó este mensaje».", confirmLabel: "Eliminar para todos", danger: true }))) return;
    const deletedAt = new Date().toISOString();
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, body: "", image: null, sticker: null, reactions: [], deletedAt } : m)));
    try {
      await backend.messaging.deleteChat(message.id);
    } catch (error) {
      setMessages((list) => list.map((m) => (m.id === message.id ? message : m)));
      toast.error(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Ajustes del chat (menú de la cabecera)
  // ---------------------------------------------------------------------------
  const update = async (patch: Parameters<typeof backend.messaging.updateConversation>[1], done: string, local: Partial<ChatConversation>) => {
    chat.patchConversation(conversationId, local);
    try {
      await backend.messaging.updateConversation(conversationId, patch);
      toast.show({ title: done, tone: "success", durationMs: 2500 });
    } catch (error) {
      toast.error(error);
    }
    void chat.reload();
  };

  const clearChat = async () => {
    if (!(await confirm({ title: "¿Vaciar este chat?", body: "Los mensajes se borran sólo para ti; la otra persona los sigue viendo.", confirmLabel: "Vaciar chat", danger: true }))) return;
    await update({ clear: true }, "Chat vaciado", { unread: 0, lastMessage: null });
    setMessages([]);
    setHasMore(false);
  };

  const removeContact = async () => {
    if (!peer) return;
    if (!(await confirm({
      title: `¿Dejar de ser contacto de ${peer.displayName}?`,
      body: "El historial se queda, pero ninguno podrá escribir hasta que vuelvan a aceptarse.",
      confirmLabel: "Quitar contacto", danger: true,
    }))) return;
    try {
      await backend.messaging.removeContact(peer.id);
      await chat.reload();
    } catch (error) {
      toast.error(error);
    }
  };

  const block = async () => {
    if (!peer) return;
    if (!(await confirm({
      title: `¿Bloquear a ${peer.displayName}?`,
      body: "No podrá escribirte, mandarte solicitudes ni encontrarte en la búsqueda. Puedes desbloquearla cuando quieras.",
      confirmLabel: "Bloquear", danger: true,
    }))) return;
    try {
      await backend.messaging.blockUser(peer.id);
      await chat.reload();
      toast.show({ title: `Bloqueaste a ${peer.displayName}` });
    } catch (error) {
      toast.error(error);
    }
  };

  const unblock = async () => {
    if (!peer) return;
    try {
      await backend.messaging.unblockUser(peer.id);
      await chat.reload();
      toast.show({ title: `Desbloqueaste a ${peer.displayName}`, body: "Para volver a escribirse, mándale una solicitud." });
    } catch (error) {
      toast.error(error);
    }
  };

  const requestAgain = async () => {
    if (!peer) return;
    try {
      const status = await backend.messaging.requestContact(peer.id);
      await chat.reload();
      toast.show({ title: status === "accepted" ? "¡Ya pueden escribirse!" : "Solicitud enviada 💌", tone: "success" });
    } catch (error) {
      toast.error(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Pintado
  // ---------------------------------------------------------------------------
  const nameOf = chat.nameOf;
  const presences = conversationPresences(participants, chat.presences);
  const typers = participants
    .filter((p) => p.userId !== me && p.conversationId === conversationId && isTyping(p.typingAt, chat.now))
    .map((p) => p.userId);
  const status = (() => {
    if (typers.length) return isGroup ? `${typers.map(nameOf).join(", ")} ${typers.length > 1 ? "están" : "está"} escribiendo…` : "escribiendo…";
    if (isGroup) return conversation.participantIds.filter((id) => id !== me).map(nameOf).join(", ");
    if (!peer) return "";
    if (blockedByMe) return "Bloqueado";
    const presence = chat.presences.find((p) => p.userId === peer.id);
    return presence ? lastSeenLabel(presence.lastSeenAt, chat.now) : "";
  })();
  const pendingFrom = peer ? chat.outgoing.find((c) => c.addresseeId === peer.id) : undefined;

  const headerItems: MenuItem[] = [
    { label: "Ver perfil", icon: "👤", onSelect: () => setShowProfile(true), hidden: !peer },
    { label: "Buscar en el chat", icon: "🔍", onSelect: () => setSearching(true) },
    conversation.muted
      ? { label: "Activar avisos", icon: "🔔", onSelect: () => void update({ muted: false }, "Avisos activados", { muted: false }) }
      : { label: "Silenciar avisos", icon: "🔕", onSelect: () => void update({ muted: true }, "Chat silenciado: no te llegarán avisos", { muted: true }) },
    conversation.pinnedAt
      ? { label: "Desfijar", icon: "📌", onSelect: () => void update({ pinned: false }, "Chat desfijado", { pinnedAt: null }) }
      : { label: "Fijar arriba", icon: "📌", onSelect: () => void update({ pinned: true }, "Chat fijado", { pinnedAt: new Date().toISOString() }) },
    conversation.archivedAt
      ? { label: "Desarchivar", icon: "🗄️", onSelect: () => void update({ archived: false }, "Chat desarchivado", { archivedAt: null }) }
      : {
        label: "Archivar", icon: "🗄️", onSelect: () => {
          void update({ archived: true }, "Chat archivado", { archivedAt: new Date().toISOString() });
          navigate("/chat");
        },
      },
    { label: "Vaciar chat", icon: "🧹", onSelect: () => void clearChat() },
    { label: "Quitar contacto", icon: "👋", onSelect: () => void removeContact(), danger: true, hidden: !peer || !chat.isContact(peer.id) },
    blockedByMe
      ? { label: "Desbloquear", icon: "🔓", onSelect: () => void unblock(), hidden: !peer }
      : { label: "Bloquear", icon: "⛔", onSelect: () => void block(), danger: true, hidden: !peer },
  ];

  let unreadShown = false;

  return (
    <div className="thread">
      <header className="thread__header">
        <Link to="/chat" className="btn btn--icon btn--ghost thread__back" aria-label="Volver a los chats"><span aria-hidden>←</span></Link>
        <button
          type="button"
          className="thread__who"
          onClick={() => peer && setShowProfile(true)}
          disabled={!peer}
          data-tour="chat-presence"
          aria-label={peer ? `${title}${status ? `, ${status}` : ""}. Ver perfil` : title}
        >
          {isGroup ? <span className="avatar avatar--emoji" style={{ "--avatar-size": "40px" } as CSSProperties} aria-hidden>👥</span> : <Avatar person={peer} size={40} />}
          <span className="thread__who-text">
            <span className="thread__name">{title}</span>
            <span className={`thread__status${status === "en línea" ? " is-online" : ""}${typers.length ? " is-typing" : ""}`} aria-live="polite">{status}</span>
          </span>
        </button>
        <button type="button" className="btn btn--icon btn--ghost" aria-label="Buscar en el chat" title="Buscar en el chat" aria-pressed={searching} onClick={() => setSearching((s) => !s)}>
          <span aria-hidden>🔍</span>
        </button>
        <Menu label="Opciones del chat" trigger={<span aria-hidden>⋮</span>} items={headerItems} tourId="chat-menu" />
      </header>
      {searching && (
        <ChatSearch
          conversationId={conversationId}
          nameOf={nameOf}
          onClose={() => setSearching(false)}
          onPick={(m) => void jumpTo(m.id, m.createdAt)}
        />
      )}
      <div className="thread__body">
        <div
          ref={scroller}
          className="thread__scroller"
          data-tour="chat-thread"
          onScroll={onScroll}
          role="log"
          aria-label={`Mensajes con ${title}`}
          aria-busy={loading}
          tabIndex={0}
        >
          {loading ? <PageLoader /> : (
            <>
              {hasMore && <button className="btn btn--sm btn--ghost chat__more" onClick={() => void loadOlder()}>Ver mensajes anteriores</button>}
              {!hasMore && (
                <p className="thread__intro">
                  <span aria-hidden>🔒</span> Sólo {isGroup ? "quienes están en este chat" : `tú y ${title}`} pueden leer estos mensajes.
                </p>
              )}
              {messages.length === 0 && (
                <div className="thread__empty">
                  <span aria-hidden>👋</span>
                  <p>Salúdale a {title} para empezar.</p>
                </div>
              )}
              {messages.map((m, i) => {
                const mine = m.senderId === me;
                const prev = messages[i - 1];
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const grouped = !newDay && prev?.senderId === m.senderId && !prev.deletedAt;
                const receipt = mine && !m.deletedAt ? receiptOf(m, presences) : null;
                const showUnread = !unreadShown && unreadFrom !== null && !mine && m.createdAt > unreadFrom;
                if (showUnread) unreadShown = true;
                return (
                  <div key={m.id} id={`msg-${m.id}`}>
                    {newDay && <div className="chat__day" role="separator" aria-label={dayFormat.format(new Date(m.createdAt))}><span>{dayFormat.format(new Date(m.createdAt))}</span></div>}
                    {showUnread && (
                      <div className="thread__unread" role="separator" data-unread-divider aria-label="Mensajes sin leer">
                        <span>{conversation.unread > 0 ? `${conversation.unread} sin leer` : "Sin leer"}</span>
                      </div>
                    )}
                    <MessageRow
                      message={m}
                      mine={mine}
                      grouped={grouped}
                      flash={flash === m.id}
                      showName={isGroup && !mine && !grouped}
                      senderName={nameOf(m.senderId)}
                      nameOf={nameOf}
                      me={me}
                      canSend={canSend}
                      imageUrl={m.localUrl ?? (m.image ? imageUrls.get(m.image.thumbPath) : undefined)}
                      receipt={receipt}
                      readers={receipt === "read" ? readersOf(m, presences).map(nameOf).join(", ") : ""}
                      now={chat.now}
                      onReply={() => startReply(m)}
                      onReact={(emoji) => void react(m, emoji)}
                      onEdit={() => startEdit(m)}
                      onCopy={() => void copy(m)}
                      onDeleteForMe={() => void removeForMe(m)}
                      onDeleteForAll={() => void removeForAll(m)}
                      onInfo={() => setInfo(m)}
                      onRetry={() => retry(m)}
                      onOpenPhoto={() => setViewing(m)}
                      onJump={(id) => void jumpTo(id)}
                    />
                  </div>
                );
              })}
              {typers.length > 0 && (
                <div className="bubble-row thread__typing" aria-hidden>
                  <div className="bubble bubble--typing"><span /><span /><span /></div>
                </div>
              )}
            </>
          )}
        </div>
        {!atBottom && (
          <button type="button" className="thread__to-bottom" onClick={scrollToBottom} aria-label={missed ? `Bajar al final, ${missed} mensajes nuevos` : "Bajar al final"}>
            <span aria-hidden>↓</span>
            {missed > 0 && <span className="thread__to-bottom-count" aria-hidden>{missed}</span>}
          </button>
        )}
      </div>
      {canSend ? (
        <form className="chat__composer thread__composer" onSubmit={send} data-tour="chat-composer" aria-label="Escribir mensaje">
          <span id="chat-ayuda" className="visually-hidden">Enter envía; Mayúsculas más Enter hace un salto de línea.</span>
          {replyingTo && (
            <div className="chat__replying" role="status">
              <button type="button" className="chat__replying-quote" onClick={() => void jumpTo(replyingTo.id, replyingTo.createdAt)}>
                <span className="bubble__quote-name">
                  {replyingTo.senderId === me ? "Respondiendo a tu mensaje" : `Respondiendo a ${nameOf(replyingTo.senderId)}`}
                </span>
                <span className="bubble__quote-text">{messagePreview(replyingTo)}</span>
              </button>
              <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Cancelar respuesta" onClick={() => setReplyingTo(null)}><span aria-hidden>✕</span></button>
            </div>
          )}
          {editing && (
            <div className="chat__replying chat__editing" role="status">
              <span className="chat__replying-quote">
                <span className="bubble__quote-name">✏️ Editando mensaje</span>
                <span className="bubble__quote-text">{messagePreview(editing)}</span>
              </span>
              <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Cancelar edición" onClick={cancelEdit}><span aria-hidden>✕</span></button>
            </div>
          )}
          {drafts.length > 0 && (
            <ul className="chat__drafts" aria-label="Fotos para enviar">
              {drafts.map((d) => (
                <li key={d.id} className="chat__draft">
                  <img src={d.url} alt={`Vista previa de ${d.file.name}`} />
                  <button type="button" className="chat__draft-remove" aria-label={`Quitar ${d.file.name}`} onClick={() => removeDraft(d.id)}><span aria-hidden>✕</span></button>
                </li>
              ))}
            </ul>
          )}
          {picker && <StickerPicker onPick={sendSticker} onClose={() => setPicker(false)} />}
          {!editing && (
            <div className="chat__tools">
              <button type="button" className="btn btn--icon btn--ghost" aria-label="Enviar fotos" title="Fotos" onClick={() => fileInput.current?.click()} data-tour="chat-photo"><span aria-hidden>📷</span></button>
              <button
                type="button"
                className="btn btn--icon btn--ghost"
                aria-label="Stickers"
                title="Stickers"
                aria-expanded={picker}
                data-sticker-toggle
                data-tour="chat-sticker"
                onClick={() => setPicker((open) => !open)}
              >
                <span aria-hidden>😊</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          <textarea
            ref={input}
            className="textarea" rows={1} maxLength={2000} value={text} aria-label={editing ? "Edita el mensaje" : "Escribe un mensaje"} aria-describedby="chat-ayuda"
            placeholder={editing ? "Edita tu mensaje…" : drafts.length ? "Añade un mensaje a la foto…" : "Escribe un mensaje…"}
            onChange={(e) => onType(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Escape" && (replyingTo || editing)) {
                e.preventDefault();
                if (editing) cancelEdit();
                else setReplyingTo(null);
              } else if (e.key === "ArrowUp" && !text && !editing) {
                // Como en las apps de escritorio: ↑ edita tu último mensaje.
                const last = [...messages].reverse().find((m) => canEditMessage(m, me, chat.now) && !m.pending && !m.failed);
                if (last) {
                  e.preventDefault();
                  startEdit(last);
                }
              } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn chat__send" disabled={editing ? (editing.kind === "text" && !text.trim()) : !text.trim() && drafts.length === 0} aria-label={editing ? "Guardar cambios" : "Enviar"}>
            <span aria-hidden>{editing ? "✓" : "➤"}</span>
          </button>
        </form>
      ) : (
        <div className="thread__locked" role="status">
          {blockedByMe ? (
            <>
              <p>Bloqueaste a {peer?.displayName}. No puede escribirte.</p>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => void unblock()}>Desbloquear</button>
            </>
          ) : peer && !peer.isActive ? (
            <p>Esta cuenta ya no está activa.</p>
          ) : pendingFrom ? (
            <p>Le enviaste una solicitud a {peer?.displayName}. Podrán escribirse cuando la acepte.</p>
          ) : (
            <>
              <p>Ya no son contactos. Para volver a escribirse, mándale una solicitud.</p>
              <button type="button" className="btn btn--sm" onClick={() => void requestAgain()}>Enviar solicitud</button>
            </>
          )}
        </div>
      )}
      {viewing?.image && (
        <Modal title={`Foto de ${nameOf(viewing.senderId)}`} onClose={() => setViewing(null)} wide>
          <figure className="chat-photo">
            <img
              src={imageUrls.get(viewing.image.path) ?? imageUrls.get(viewing.image.thumbPath)}
              alt={viewing.body || `Foto de ${nameOf(viewing.senderId)}`}
              width={viewing.image.width ?? undefined}
              height={viewing.image.height ?? undefined}
            />
            {viewing.body && <figcaption>{viewing.body}</figcaption>}
          </figure>
        </Modal>
      )}
      {info && (
        <Modal title="Información del mensaje" onClose={() => setInfo(null)}>
          <dl className="message-info">
            <dt>Enviado</dt>
            <dd>{fullFormat.format(new Date(info.createdAt))}</dd>
            {info.editedAt && (<><dt>Editado</dt><dd>{fullFormat.format(new Date(info.editedAt))}</dd></>)}
            {participants.filter((p) => p.userId !== info.senderId).map((p) => {
              const read = p.lastReadAt && p.lastReadAt >= info.createdAt;
              return (
                <div key={p.userId} className="message-info__row">
                  <dt>{nameOf(p.userId)}</dt>
                  <dd>{read ? `✓✓ Visto · ${fullFormat.format(new Date(p.lastReadAt!))}` : "Todavía no lo ve"}</dd>
                </div>
              );
            })}
          </dl>
        </Modal>
      )}
      {showProfile && peer && <ProfileCard profile={peer} onClose={() => setShowProfile(false)} />}
      {confirmDialog}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Un mensaje
// -----------------------------------------------------------------------------

interface MessageRowProps {
  message: Pending;
  mine: boolean;
  grouped: boolean;
  flash: boolean;
  showName: boolean;
  senderName: string;
  nameOf(id: string): string;
  me: string | null;
  canSend: boolean;
  imageUrl: string | undefined;
  receipt: Receipt | null;
  readers: string;
  now: Date;
  onReply(): void;
  onReact(emoji: string): void;
  onEdit(): void;
  onCopy(): void;
  onDeleteForMe(): void;
  onDeleteForAll(): void;
  onInfo(): void;
  onRetry(): void;
  onOpenPhoto(): void;
  onJump(id: string): void;
}

function MessageRow(props: MessageRowProps) {
  const { message: m, mine, grouped, me } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const deleted = Boolean(m.deletedAt);
  const live = !m.pending && !m.failed && !deleted;

  const items: MenuItem[] = [
    { label: "Responder", icon: "↩", onSelect: props.onReply, hidden: !live || !props.canSend },
    { label: "Copiar", icon: "📋", onSelect: props.onCopy, hidden: !live || !m.body },
    { label: "Editar", icon: "✏️", onSelect: props.onEdit, hidden: !live || !props.canSend || !canEditMessage(m, me, props.now) },
    { label: "Información", icon: "ℹ️", onSelect: props.onInfo, hidden: !live || !mine },
    { label: "Reintentar", icon: "↻", onSelect: props.onRetry, hidden: !m.failed },
    { label: "Eliminar para mí", icon: "🗑️", onSelect: props.onDeleteForMe, danger: true, hidden: m.pending },
    { label: "Eliminar para todos", icon: "🚫", onSelect: props.onDeleteForAll, danger: true, hidden: !live || !mine },
  ];
  const reactions = groupReactions(m.reactions);
  const myReaction = m.reactions.find((r) => r.userId === me)?.emoji;

  return (
    <SwipeRow
      className={`bubble-row${mine ? " is-mine" : ""}${grouped ? " is-grouped" : ""}${props.flash ? " is-flash" : ""}${reactions.length ? " has-reactions" : ""}`}
      enabled={live && props.canSend}
      onReply={props.onReply}
      onLongPress={() => setMenuOpen(true)}
    >
      <div className={`bubble bubble--${deleted ? "deleted" : m.kind}${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
        {props.showName
          ? <span className="bubble__name">{props.senderName}</span>
          : <span className="visually-hidden">{mine ? "Tú" : props.senderName}:</span>}
        {deleted ? (
          <span className="bubble__text bubble__deleted">{DELETED_LABEL}</span>
        ) : (
          <>
            {m.replyTo && (
              <button
                type="button"
                className="bubble__quote"
                onClick={() => props.onJump(m.replyTo!.id)}
                aria-label={`En respuesta a ${m.replyTo.senderId ? props.nameOf(m.replyTo.senderId) : "un mensaje"}: ${messagePreview(m.replyTo)}. Ir al mensaje`}
              >
                <span className="bubble__quote-name">{m.replyTo.senderId ? props.nameOf(m.replyTo.senderId) : "Mensaje"}</span>
                <span className="bubble__quote-text">{messagePreview(m.replyTo)}</span>
              </button>
            )}
            {m.kind === "image" && (
              <button
                type="button"
                className="bubble__photo"
                disabled={m.pending || m.failed}
                onClick={props.onOpenPhoto}
                aria-label={`Ver foto de ${props.senderName}${m.body ? `: ${quoteSnippet(m.body, 60)}` : ""}`}
              >
                {props.imageUrl ? (
                  <img src={props.imageUrl} alt="" width={m.image?.width ?? undefined} height={m.image?.height ?? undefined} loading="lazy" decoding="async" />
                ) : <span className="bubble__photo-placeholder" aria-hidden>📷</span>}
                {m.pending && <span className="bubble__uploading"><span className="bubble__heart" aria-hidden>💗</span> Enviando foto…</span>}
              </button>
            )}
            {m.kind === "sticker" && <StickerArt id={m.sticker} />}
            {m.body && <span className="bubble__text">{m.body}</span>}
          </>
        )}
        <span className="bubble__time">
          {m.editedAt && !deleted && <span className="bubble__edited">editado · </span>}
          <time dateTime={m.createdAt}>{timeFormat.format(new Date(m.createdAt))}</time>
          {props.receipt && <ReceiptMark receipt={props.receipt} readers={props.readers} />}
        </span>
        {reactions.length > 0 && (
          <span className="bubble__reactions">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`reaction-chip${r.userIds.includes(me ?? "") ? " is-mine" : ""}`}
                onClick={() => props.canSend && props.onReact(r.emoji)}
                aria-label={`${r.emoji} de ${r.userIds.map(props.nameOf).join(", ")}${r.userIds.includes(me ?? "") ? ". Toca para quitar la tuya" : ""}`}
                title={r.userIds.map(props.nameOf).join(", ")}
              >
                <span aria-hidden>{r.emoji}</span>{r.userIds.length > 1 && <span aria-hidden>{r.userIds.length}</span>}
              </button>
            ))}
          </span>
        )}
      </div>
      {!m.pending && (
        <div className="bubble__actions">
          {live && props.canSend && (
            <button type="button" className="btn btn--icon btn--ghost btn--sm bubble__reply" aria-label={`Responder a ${mine ? "tu mensaje" : props.senderName}: ${messagePreview(m, 40)}`} title="Responder" onClick={props.onReply}>
              <span aria-hidden>↩</span>
            </button>
          )}
          <Menu
            label={`Opciones del mensaje: ${messagePreview(m, 40)}`}
            trigger={<span aria-hidden>⌄</span>}
            items={items}
            align={mine ? "end" : "start"}
            className="bubble__menu"
            open={menuOpen}
            onOpenChange={setMenuOpen}
            preview={(
              <>
                <span className="menu__preview-name">{mine ? "Tú" : props.senderName}</span>
                <span className="menu__preview-text">{messagePreview(m, 120)}</span>
              </>
            )}
            header={live && props.canSend ? (close) => (
              <div className="reaction-bar" role="group" aria-label="Reaccionar">
                {REACTIONS.map((emoji, i) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitemradio"
                    aria-checked={myReaction === emoji}
                    tabIndex={-1}
                    data-menu-first={i === 0 ? "" : undefined}
                    className={`reaction-bar__item${myReaction === emoji ? " is-mine" : ""}`}
                    aria-label={`Reaccionar con ${emoji}`}
                    onClick={() => {
                      close();
                      props.onReact(emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
        </div>
      )}
    </SwipeRow>
  );
}

/** Fila de un mensaje: se desliza a la derecha para responder y se mantiene pulsada para ver opciones. */
function SwipeRow({ className, enabled, onReply, onLongPress, children }: {
  className: string;
  enabled: boolean;
  onReply(): void;
  onLongPress(): void;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const press = useRef<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const reset = () => {
    start.current = null;
    window.clearTimeout(press.current);
    setOffset(0);
  };

  return (
    <div
      className={`${className}${offset > 0 ? " is-swiping" : ""}`}
      style={offset > 0 ? { transform: `translateX(${offset}px)` } : undefined}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" || (e.target as Element).closest("button, a, [role=menu]")) return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        press.current = window.setTimeout(() => {
          navigator.vibrate?.(10);
          start.current = null;
          setOffset(0);
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 8 || Math.abs(e.clientY - s.y) > 8) window.clearTimeout(press.current);
        if (!enabled) return;
        // Un gesto vertical es scroll, no una respuesta.
        if (Math.abs(e.clientY - s.y) > 24 && offset === 0) return reset();
        setOffset(Math.max(0, Math.min(dx, SWIPE_TO_REPLY + 24)));
      }}
      onPointerUp={() => {
        if (enabled && offset >= SWIPE_TO_REPLY) {
          navigator.vibrate?.(15);
          onReply();
        }
        reset();
      }}
      onPointerCancel={reset}
      onContextMenu={(e) => {
        // Clic derecho en escritorio: las opciones del mensaje.
        if ((e.target as Element).closest("a, img")) return;
        e.preventDefault();
        onLongPress();
      }}
    >
      {offset > 0 && <span className="bubble-row__hint" aria-hidden>↩</span>}
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Buscar en el chat
// -----------------------------------------------------------------------------

function ChatSearch({ conversationId, nameOf, onClose, onPick }: {
  conversationId: string;
  nameOf(id: string): string;
  onClose(): void;
  onPick(message: ChatMessage): void;
}) {
  const backend = useBackend();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      backend.messaging.searchChat(conversationId, q)
        .then((found) => active && setResults(found))
        .catch(() => active && setResults([]));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [backend, conversationId, query]);

  return (
    <div className="thread-search" role="search">
      <div className="thread-search__bar">
        <label htmlFor="buscar-mensajes" className="visually-hidden">Buscar mensajes en este chat</label>
        <input
          id="buscar-mensajes" className="input" type="search" placeholder="Buscar mensajes…" value={query} autoFocus autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <button type="button" className="btn btn--icon btn--ghost" aria-label="Cerrar la búsqueda" onClick={onClose}><span aria-hidden>✕</span></button>
      </div>
      <p className="visually-hidden" role="status">
        {results === null ? "" : results.length === 0 ? "Sin resultados" : `${results.length} resultados`}
      </p>
      {results !== null && (
        <ul className="thread-search__results">
          {results.length === 0 && <li className="muted thread-search__none">No hay mensajes con «{query.trim()}».</li>}
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" className="thread-search__hit" onClick={() => onPick(m)}>
                <span className="thread-search__meta">
                  <strong>{nameOf(m.senderId)}</strong>
                  <time dateTime={m.createdAt}>{dayFormat.format(new Date(m.createdAt))}</time>
                </span>
                <Highlight text={quoteSnippet(m.body, 120)} query={query.trim()} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Resalta lo buscado (sin distinguir mayúsculas). */
function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}
    </span>
  );
}
