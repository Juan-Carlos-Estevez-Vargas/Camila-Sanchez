import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import type { ChatSendOptions } from "@/data/ports";
import { lastSeenLabel, messagePreview, quoteSnippet, readersOf, receiptOf, upsertPresence, type Receipt } from "@/domain/chat";
import type { ChatImage, ChatKind, ChatMessage, ChatPresence, ChatReplyPreview, Profile } from "@/domain/types";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { Avatar } from "@/ui/Avatar";
import { Modal } from "@/ui/Modal";
import { ProfileCard } from "@/features/auth/ProfileCard";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { EnableNotifications } from "@/features/messages/EnableNotifications";
import "@/features/messages/styles/messages.scss";
import { StickerArt } from "./StickerArt";
import { StickerPicker } from "./StickerPicker";

const PAGE = 40;
/** Cada cuánto se refresca el texto de la última conexión. */
const CLOCK_MS = 20_000;
/** Distancia (px) que hay que deslizar un mensaje para responderlo. */
const SWIPE_TO_REPLY = 56;
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
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
  return {
    id: String(r.id),
    senderId: String(r.sender_id ?? r.senderId),
    kind: (r.kind as ChatKind | undefined) ?? "text",
    body: String(r.body ?? ""),
    image: (r.image as ChatImage | null | undefined) ?? (imagePath
      ? {
        path: imagePath,
        thumbPath: String(r.thumb_path ?? imagePath),
        width: (r.image_width as number | null) ?? null,
        height: (r.image_height as number | null) ?? null,
      }
      : null),
    sticker: (r.sticker as string | null | undefined) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    replyTo: embedded ?? (replyId
      ? {
        id: replyId,
        senderId: original?.senderId ?? "",
        body: original?.body ?? "Mensaje anterior",
        kind: original?.kind ?? "text",
        sticker: original?.sticker ?? null,
      }
      : null),
  };
}

function presenceFromRecord(r: Row): ChatPresence {
  return {
    userId: String(r.user_id ?? r.userId),
    lastSeenAt: String(r.last_seen_at ?? r.lastSeenAt),
    lastReadAt: (r.last_read_at ?? r.lastReadAt ?? null) as string | null,
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

export default function ChatPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const { markAllRead } = useNotifications();
  const toast = useToast();
  const [messages, setMessages] = useState<Pending[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [presences, setPresences] = useState<ChatPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [flash, setFlash] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [picker, setPicker] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(() => new Map());
  const [viewing, setViewing] = useState<Pending | null>(null);
  const [profileOf, setProfileOf] = useState<Profile | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);
  const processor = useMemo(() => new ImageProcessor(CHAT_IMAGE_OPTIONS), []);

  useEffect(() => () => processor.dispose(), [processor]);

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
      backend.messaging.listChat({ limit: PAGE }),
      backend.users.listProfiles(),
      backend.messaging.listChatPresence(),
    ])
      .then(([msgs, profiles, seen]) => {
        if (!active) return;
        setMessages(msgs);
        setHasMore(msgs.length === PAGE);
        setPeople(profiles);
        setPresences(seen);
      })
      .catch((error) => toast.error(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [backend, toast]);

  // Mensajes, vistos y conexiones en tiempo real.
  useEffect(() => backend.realtime.subscribe(["chat_messages", "chat_reads"], (change) => {
    const r = change.record as Row | null;
    if (change.table === "chat_reads") {
      if (r) setPresences((list) => upsertPresence(list, presenceFromRecord(r)));
      return;
    }
    if (change.type === "INSERT" && r) {
      setMessages((list) => merge(list, [messageFromRecord(r, list)]));
    }
    if (change.type === "DELETE" && change.old?.id) {
      const id = change.old.id;
      setMessages((list) => list
        .filter((m) => m.id !== id)
        .map((m) => (m.replyTo?.id === id ? { ...m, replyTo: null } : m)));
    }
  }), [backend]);

  // Mientras el chat está a la vista, lo que llega se da por visto.
  useEffect(() => {
    const markRead = () => {
      if (document.visibilityState !== "visible") return;
      void markAllRead("chat");
      void backend.messaging.touchChatPresence({ read: true }).catch(() => undefined);
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [messages.length, markAllRead, backend]);

  // «últ. vez hace 3 min» avanza aunque no llegue nada nuevo.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    stickToBottom.current = false;
    const older = await backend.messaging.listChat({ before: first.createdAt, limit: PAGE });
    setHasMore(older.length === PAGE);
    setMessages((list) => merge(list, older));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }, [backend, messages]);

  const startReply = (message: ChatMessage) => {
    setReplyingTo(message);
    input.current?.focus();
  };

  /** Lleva al mensaje citado y lo resalta un momento. */
  const jumpTo = (id: string) => {
    const target = document.getElementById(`msg-${id}`);
    if (!target) {
      toast.show({ title: "Ese mensaje es más antiguo", body: "Toca «Ver mensajes anteriores» para cargarlo." });
      return;
    }
    stickToBottom.current = false;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    window.setTimeout(() => setFlash((current) => (current === id ? null : current)), 1600);
  };

  /** Muestra el mensaje al instante y lo confirma (o lo marca fallido) al volver del servidor. */
  const deliver = async (temp: Pending, body: string, options: ChatSendOptions) => {
    stickToBottom.current = true;
    setMessages((list) => merge(list, [temp]));
    try {
      const saved = await backend.messaging.sendChat(body, options);
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
    id: `tmp-${crypto.randomUUID()}`, senderId: user!.id, kind: "text", body: "", image: null, sticker: null,
    createdAt: new Date().toISOString(), pending: true,
    replyTo: quoted ? { id: quoted.id, senderId: quoted.senderId, body: quoted.body, kind: quoted.kind, sticker: quoted.sticker } : null,
    ...patch,
  });

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && drafts.length === 0) || !user) return;
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

  const sendSticker = (id: string) => {
    if (!user) return;
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
    if (files.length) {
      e.preventDefault();
      addPhotos(files);
    }
  };

  const nameOf = (id: string) => (id === user?.id ? "Tú" : people.find((p) => p.id === id)?.displayName ?? "Alguien");
  const others = people.filter((p) => p.id !== user?.id && p.isActive);
  const statusOf = (id: string) => {
    const presence = presences.find((p) => p.userId === id);
    return presence ? lastSeenLabel(presence.lastSeenAt, now) : null;
  };

  return (
    <main id="contenido-principal" className="container chat">
      <header className="chat__header">
        <div>
          <h1>Chat</h1>
          {others.length > 0 && (
            <div className="muted chat__people">
              {others.map((p) => {
                const status = statusOf(p.id);
                return (
                  <button key={p.id} type="button" className="chat__person" data-tour="chat-presence" onClick={() => setProfileOf(p)} title={`Ver el perfil de ${p.displayName}`}>
                    <Avatar person={p} size={30} />
                    <span>
                      Con {p.displayName}
                      {status && (
                        <span className={`chat__status${status === "en línea" ? " is-online" : ""}`}> · {status}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>
      <EnableNotifications />
      <div
        ref={scroller}
        className="chat__scroller card"
        data-tour="chat-thread"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
      >
        {loading ? <PageLoader /> : messages.length === 0 ? (
          <EmptyState icon="💬" title="Empiecen a hablar">Escribe el primer mensaje 💖</EmptyState>
        ) : (
          <>
            {hasMore && <button className="btn btn--sm btn--ghost chat__more" onClick={() => void loadOlder()}>Ver mensajes anteriores</button>}
            {messages.map((m, i) => {
              const mine = m.senderId === user?.id;
              const prev = messages[i - 1];
              const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
              const grouped = !newDay && prev?.senderId === m.senderId;
              const receipt = mine ? receiptOf(m, presences) : null;
              return (
                <div key={m.id} id={`msg-${m.id}`}>
                  {newDay && <div className="chat__day">{dayFormat.format(new Date(m.createdAt))}</div>}
                  <SwipeRow
                    className={`bubble-row${mine ? " is-mine" : ""}${grouped ? " is-grouped" : ""}${flash === m.id ? " is-flash" : ""}`}
                    enabled={!m.pending && !m.failed}
                    onReply={() => startReply(m)}
                  >
                    <div className={`bubble bubble--${m.kind}${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
                      {!mine && !grouped && <span className="bubble__name">{nameOf(m.senderId)}</span>}
                      {m.replyTo && (
                        <button type="button" className="bubble__quote" onClick={() => jumpTo(m.replyTo!.id)}>
                          <span className="bubble__quote-name">{m.replyTo.senderId ? nameOf(m.replyTo.senderId) : "Mensaje"}</span>
                          <span className="bubble__quote-text">{messagePreview(m.replyTo)}</span>
                        </button>
                      )}
                      {m.kind === "image" && (
                        <button
                          type="button"
                          className="bubble__photo"
                          disabled={m.pending || m.failed}
                          onClick={() => setViewing(m)}
                          aria-label={`Ver foto de ${nameOf(m.senderId)}${m.body ? `: ${quoteSnippet(m.body, 60)}` : ""}`}
                        >
                          {(m.localUrl || (m.image && imageUrls.get(m.image.thumbPath))) ? (
                            <img
                              src={m.localUrl ?? imageUrls.get(m.image!.thumbPath)}
                              alt=""
                              width={m.image?.width ?? undefined}
                              height={m.image?.height ?? undefined}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : <span className="bubble__photo-placeholder" aria-hidden>📷</span>}
                          {m.pending && <span className="bubble__uploading"><span className="bubble__heart" aria-hidden>💗</span> Enviando foto…</span>}
                        </button>
                      )}
                      {m.kind === "sticker" && <StickerArt id={m.sticker} />}
                      {m.body && <span className="bubble__text">{m.body}</span>}
                      <span className="bubble__time">
                        {timeFormat.format(new Date(m.createdAt))}
                        {receipt && <ReceiptMark receipt={receipt} readers={readersOf(m, presences).map(nameOf).join(", ")} />}
                      </span>
                    </div>
                    {!m.pending && !m.failed && (
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost btn--sm bubble__reply"
                        aria-label={`Responder a ${mine ? "tu mensaje" : nameOf(m.senderId)}: ${messagePreview(m, 40)}`}
                        title="Responder"
                        onClick={() => startReply(m)}
                      >
                        ↩
                      </button>
                    )}
                  </SwipeRow>
                </div>
              );
            })}
          </>
        )}
      </div>
      <form className="chat__composer" onSubmit={send} data-tour="chat-composer">
        {replyingTo && (
          <div className="chat__replying" role="status">
            <button type="button" className="chat__replying-quote" onClick={() => jumpTo(replyingTo.id)}>
              <span className="bubble__quote-name">
                {replyingTo.senderId === user?.id ? "Respondiendo a tu mensaje" : `Respondiendo a ${nameOf(replyingTo.senderId)}`}
              </span>
              <span className="bubble__quote-text">{messagePreview(replyingTo)}</span>
            </button>
            <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Cancelar respuesta" onClick={() => setReplyingTo(null)}>✕</button>
          </div>
        )}
        {drafts.length > 0 && (
          <ul className="chat__drafts" aria-label="Fotos para enviar">
            {drafts.map((d) => (
              <li key={d.id} className="chat__draft">
                <img src={d.url} alt={d.file.name} />
                <button type="button" className="chat__draft-remove" aria-label={`Quitar ${d.file.name}`} onClick={() => removeDraft(d.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
        {picker && <StickerPicker onPick={sendSticker} onClose={() => setPicker(false)} />}
        <div className="chat__tools">
          <button type="button" className="btn btn--icon btn--ghost" aria-label="Enviar fotos" title="Fotos" onClick={() => fileInput.current?.click()} data-tour="chat-photo">📷</button>
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
            😊
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
        <textarea
          ref={input}
          className="textarea" rows={1} maxLength={2000} value={text} aria-label="Mensaje"
          placeholder={drafts.length ? "Añade un mensaje a la foto…" : "Escribe algo bonito…"}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Escape" && replyingTo) {
              e.preventDefault();
              setReplyingTo(null);
            } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn" disabled={!text.trim() && drafts.length === 0} aria-label="Enviar"><span className="chat__send-label">Enviar </span>💌</button>
      </form>
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
      {profileOf && <ProfileCard profile={profileOf} onClose={() => setProfileOf(null)} />}
    </main>
  );
}

/** Fila de un mensaje que se desliza a la derecha para responderlo (táctil). */
function SwipeRow({ className, enabled, onReply, children }: {
  className: string;
  enabled: boolean;
  onReply(): void;
  children: React.ReactNode;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [offset, setOffset] = useState(0);

  const reset = () => {
    start.current = null;
    setOffset(0);
  };

  return (
    <div
      className={`${className}${offset > 0 ? " is-swiping" : ""}`}
      style={offset > 0 ? { transform: `translateX(${offset}px)` } : undefined}
      onPointerDown={(e) => {
        if (!enabled || e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        // Un gesto vertical es scroll, no una respuesta.
        if (Math.abs(e.clientY - s.y) > 24 && offset === 0) return reset();
        setOffset(Math.max(0, Math.min(dx, SWIPE_TO_REPLY + 24)));
      }}
      onPointerUp={() => {
        if (offset >= SWIPE_TO_REPLY) {
          navigator.vibrate?.(15);
          onReply();
        }
        reset();
      }}
      onPointerCancel={reset}
    >
      {offset > 0 && <span className="bubble-row__hint" aria-hidden>↩</span>}
      {children}
    </div>
  );
}
