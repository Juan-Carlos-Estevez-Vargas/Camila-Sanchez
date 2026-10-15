import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, Profile } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { EnableNotifications } from "@/features/messages/EnableNotifications";
import "@/features/messages/styles/messages.scss";

const PAGE = 40;
const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

interface Pending extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

/** Inserta o reemplaza por id manteniendo orden cronológico (sin duplicados). */
function merge(list: Pending[], incoming: Pending[]): Pending[] {
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default function ChatPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const { markAllRead } = useNotifications();
  const toast = useToast();
  const [messages, setMessages] = useState<Pending[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    let active = true;
    Promise.all([backend.messaging.listChat({ limit: PAGE }), backend.users.listProfiles()])
      .then(([msgs, profiles]) => {
        if (!active) return;
        setMessages(msgs);
        setHasMore(msgs.length === PAGE);
        setPeople(profiles);
      })
      .catch((error) => toast.error(error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [backend, toast]);

  // Mensajes nuevos en tiempo real.
  useEffect(() => backend.realtime.subscribe(["chat_messages"], (change) => {
    const r = change.record as Record<string, unknown> | null;
    if (change.type === "INSERT" && r) {
      const msg: ChatMessage = {
        id: String(r.id),
        senderId: String(r.sender_id ?? r.senderId),
        body: String(r.body),
        createdAt: String(r.created_at ?? r.createdAt),
      };
      setMessages((list) => merge(list, [msg]));
    }
    if (change.type === "DELETE" && change.old?.id) {
      setMessages((list) => list.filter((m) => m.id !== change.old!.id));
    }
  }), [backend]);

  // Mientras el chat está abierto, sus avisos se dan por leídos.
  useEffect(() => {
    if (document.visibilityState === "visible") void markAllRead("chat");
  }, [messages.length, markAllRead]);

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

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    stickToBottom.current = true;
    // Optimista: aparece al instante y se confirma al volver del servidor.
    const tempId = `tmp-${crypto.randomUUID()}`;
    const temp: Pending = { id: tempId, senderId: user.id, body, createdAt: new Date().toISOString(), pending: true };
    setMessages((list) => merge(list, [temp]));
    try {
      const saved = await backend.messaging.sendChat(body);
      setMessages((list) => merge(list.filter((m) => m.id !== tempId), [saved]));
    } catch (error) {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error(error, "No se envió");
    }
  };

  const nameOf = (id: string) => people.find((p) => p.id === id)?.displayName ?? "Alguien";
  const others = people.filter((p) => p.id !== user?.id && p.isActive).map((p) => p.displayName).join(", ");

  return (
    <main id="contenido-principal" className="container chat">
      <header className="chat__header">
        <div>
          <h1>Chat</h1>
          {others && <p className="muted">Con {others}</p>}
        </div>
      </header>
      <EnableNotifications />
      <div
        ref={scroller}
        className="chat__scroller card"
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
              return (
                <div key={m.id}>
                  {newDay && <div className="chat__day">{dayFormat.format(new Date(m.createdAt))}</div>}
                  <div className={`bubble-row${mine ? " is-mine" : ""}${grouped ? " is-grouped" : ""}`}>
                    <div className={`bubble${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
                      {!mine && !grouped && <span className="bubble__name">{nameOf(m.senderId)}</span>}
                      <span className="bubble__text">{m.body}</span>
                      <span className="bubble__time">
                        {timeFormat.format(new Date(m.createdAt))}{m.pending ? " · enviando" : m.failed ? " · no enviado" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <form className="chat__composer" onSubmit={send}>
        <textarea
          className="textarea" rows={1} maxLength={2000} placeholder="Escribe algo bonito…" value={text} aria-label="Mensaje"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
