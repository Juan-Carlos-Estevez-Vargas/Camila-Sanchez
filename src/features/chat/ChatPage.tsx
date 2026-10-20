import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { lastSeenLabel, quoteSnippet, readersOf, receiptOf, upsertPresence, type Receipt } from "@/domain/chat";
import type { ChatMessage, ChatPresence, ChatReplyPreview, Profile } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { EnableNotifications } from "@/features/messages/EnableNotifications";
import "@/features/messages/styles/messages.scss";

const PAGE = 40;
/** Cada cuánto se refresca el texto de la última conexión. */
const CLOCK_MS = 20_000;
/** Distancia (px) que hay que deslizar un mensaje para responderlo. */
const SWIPE_TO_REPLY = 56;
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

interface Pending extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
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
  return {
    id: String(r.id),
    senderId: String(r.sender_id ?? r.senderId),
    body: String(r.body),
    createdAt: String(r.created_at ?? r.createdAt),
    replyTo: embedded ?? (replyId
      ? { id: replyId, senderId: original?.senderId ?? "", body: original?.body ?? "Mensaje anterior" }
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
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

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

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    const quoted = replyingTo;
    setText("");
    setReplyingTo(null);
    stickToBottom.current = true;
    // Optimista: aparece al instante y se confirma al volver del servidor.
    const tempId = `tmp-${crypto.randomUUID()}`;
    const temp: Pending = {
      id: tempId, senderId: user.id, body, createdAt: new Date().toISOString(), pending: true,
      replyTo: quoted ? { id: quoted.id, senderId: quoted.senderId, body: quoted.body } : null,
    };
    setMessages((list) => merge(list, [temp]));
    try {
      const saved = await backend.messaging.sendChat(body, { replyToId: quoted?.id ?? null });
      setMessages((list) => merge(list.filter((m) => m.id !== tempId), [saved]));
    } catch (error) {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error(error, "No se envió");
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
            <p className="muted chat__people">
              {others.map((p) => {
                const status = statusOf(p.id);
                return (
                  <span key={p.id} className="chat__person" data-tour="chat-presence">
                    Con {p.displayName}
                    {status && (
                      <span className={`chat__status${status === "en línea" ? " is-online" : ""}`}> · {status}</span>
                    )}
                  </span>
                );
              })}
            </p>
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
                    <div className={`bubble${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
                      {!mine && !grouped && <span className="bubble__name">{nameOf(m.senderId)}</span>}
                      {m.replyTo && (
                        <button type="button" className="bubble__quote" onClick={() => jumpTo(m.replyTo!.id)}>
                          <span className="bubble__quote-name">{m.replyTo.senderId ? nameOf(m.replyTo.senderId) : "Mensaje"}</span>
                          <span className="bubble__quote-text">{quoteSnippet(m.replyTo.body)}</span>
                        </button>
                      )}
                      <span className="bubble__text">{m.body}</span>
                      <span className="bubble__time">
                        {timeFormat.format(new Date(m.createdAt))}
                        {receipt && <ReceiptMark receipt={receipt} readers={readersOf(m, presences).map(nameOf).join(", ")} />}
                      </span>
                    </div>
                    {!m.pending && !m.failed && (
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost btn--sm bubble__reply"
                        aria-label={`Responder a ${mine ? "tu mensaje" : nameOf(m.senderId)}: ${quoteSnippet(m.body, 40)}`}
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
              <span className="bubble__quote-text">{quoteSnippet(replyingTo.body)}</span>
            </button>
            <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Cancelar respuesta" onClick={() => setReplyingTo(null)}>✕</button>
          </div>
        )}
        <textarea
          ref={input}
          className="textarea" rows={1} maxLength={2000} placeholder="Escribe algo bonito…" value={text} aria-label="Mensaje"
          onChange={(e) => setText(e.target.value)}
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
        <button className="btn" disabled={!text.trim()} aria-label="Enviar">Enviar 💌</button>
      </form>
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
