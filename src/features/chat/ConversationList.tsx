import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { inboxTime, isOnline, isTyping, matchesSearch, messagePreview, sortConversations } from "@/domain/chat";
import type { ChatConversation } from "@/domain/types";
import { Avatar } from "@/ui/Avatar";
import { useChat } from "./ChatStore";

/** Bandeja: chats fijados arriba, buscador y archivados aparte. */
export function ConversationList({ activeId }: { activeId: string | null }) {
  const chat = useChat();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);

  const { visible, archivedCount } = useMemo(() => {
    const all = sortConversations(chat.conversations);
    const matching = all.filter((c) => matchesSearch(chat.titleOf(c), query));
    return {
      visible: matching.filter((c) => Boolean(c.archivedAt) === archived),
      archivedCount: all.filter((c) => c.archivedAt).length,
    };
  }, [chat, query, archived]);

  if (!chat.ready) {
    return (
      <ul className="chat-list" aria-busy="true" aria-label="Cargando chats">
        {[0, 1, 2].map((i) => <li key={i} className="chat-list__skeleton" aria-hidden />)}
      </ul>
    );
  }

  return (
    <>
      <div className="chat-side__search">
        <label htmlFor="buscar-chat" className="visually-hidden">Buscar en tus chats</label>
        <input
          id="buscar-chat" className="input" type="search" placeholder="Buscar un chat" value={query}
          onChange={(e) => setQuery(e.target.value)} autoComplete="off"
        />
      </div>
      {(archivedCount > 0 || archived) && (
        <button type="button" className="chat-list__archived" onClick={() => setArchived((a) => !a)} aria-pressed={archived}>
          <span aria-hidden>{archived ? "←" : "🗄️"}</span>
          {archived ? "Volver a los chats" : `Archivados (${archivedCount})`}
        </button>
      )}
      {visible.length === 0 ? (
        <div className="chat-list__empty">
          {query ? (
            <p className="muted">Ningún chat se llama así.</p>
          ) : archived ? (
            <p className="muted">No tienes chats archivados.</p>
          ) : (
            <>
              <p><strong>Todavía no tienes chats</strong></p>
              <p className="muted">Busca a alguien y mándale una solicitud. Cuando la acepte, podrán hablar.</p>
              <Link to="/chat/personas" className="btn btn--sm">Buscar personas</Link>
            </>
          )}
        </div>
      ) : (
        <ul className="chat-list" aria-label={archived ? "Chats archivados" : "Chats"}>
          {visible.map((c) => <ConversationItem key={c.id} conversation={c} active={c.id === activeId} />)}
        </ul>
      )}
    </>
  );
}

function ConversationItem({ conversation: c, active }: { conversation: ChatConversation; active: boolean }) {
  const chat = useChat();
  const peer = chat.peerOf(c);
  const title = chat.titleOf(c);
  const online = c.kind === "direct" && peer
    ? (() => {
      const p = chat.presences.find((x) => x.userId === peer.id);
      return p ? isOnline(p.lastSeenAt, chat.now) : false;
    })()
    : false;
  const typers = [...(chat.typing.get(c.id) ?? [])].filter(([, at]) => isTyping(at, chat.now)).map(([id]) => id);
  const last = c.lastMessage;
  const preview = typers.length
    ? c.kind === "group" ? `${chat.nameOf(typers[0])} está escribiendo…` : "escribiendo…"
    : last
      ? `${last.senderId === chat.me ? "Tú: " : c.kind === "group" ? `${chat.nameOf(last.senderId)}: ` : ""}${messagePreview(last, 70)}`
      : "Empiecen a hablar 💬";
  const when = last?.createdAt ?? c.lastMessageAt;
  const summary = [
    title,
    online ? "en línea" : null,
    c.unread > 0 ? `${c.unread} sin leer` : null,
    c.pinnedAt ? "fijado" : null,
    c.muted ? "silenciado" : null,
    preview,
  ].filter(Boolean).join(", ");

  return (
    <li>
      <Link
        to={`/chat/${c.id}`}
        className={`chat-item${active ? " is-active" : ""}${c.unread > 0 ? " is-unread" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={summary}
      >
        <span className="chat-item__avatar">
          {c.kind === "group" ? <span className="avatar avatar--emoji" style={{ "--avatar-size": "48px" } as CSSProperties} aria-hidden>👥</span> : <Avatar person={peer} size={48} />}
          {online && <span className="chat-item__online" aria-hidden />}
        </span>
        <span className="chat-item__body" aria-hidden>
          <span className="chat-item__top">
            <span className="chat-item__name">{title}</span>
            {when && <time className="chat-item__time" dateTime={when}>{inboxTime(when, chat.now)}</time>}
          </span>
          <span className="chat-item__bottom">
            <span className={`chat-item__preview${typers.length ? " is-typing" : ""}`}>{preview}</span>
            <span className="chat-item__flags">
              {c.muted && <span title="Silenciado">🔕</span>}
              {c.pinnedAt && <span title="Fijado">📌</span>}
              {c.unread > 0 && <span className="chat-item__badge">{c.unread > 99 ? "99+" : c.unread}</span>}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
