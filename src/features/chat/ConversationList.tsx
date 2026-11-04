import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { inboxTime, isOnline, isTyping, matchesSearch, messagePreview, sortConversations } from "@/domain/chat";
import type { ChatConversation } from "@/domain/types";
import { Avatar } from "@/ui/Avatar";
import { useChat } from "./ChatStore";
import { useT } from "@/i18n";

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
  const i18n = useT();
  const t = i18n.chat.list;

  if (!chat.ready) {
    return (
      <ul className="chat-list" aria-busy="true" aria-label={t.loading}>
        {[0, 1, 2].map((i) => <li key={i} className="chat-list__skeleton" aria-hidden />)}
      </ul>
    );
  }

  return (
    <>
      <div className="chat-side__search">
        <label htmlFor="buscar-chat" className="visually-hidden">{t.searchLabel}</label>
        <input
          id="buscar-chat" className="input" type="search" placeholder={t.searchPlaceholder} value={query}
          onChange={(e) => setQuery(e.target.value)} autoComplete="off"
        />
      </div>
      {(archivedCount > 0 || archived) && (
        <button type="button" className="chat-list__archived" onClick={() => setArchived((a) => !a)} aria-pressed={archived}>
          <span aria-hidden>{archived ? "←" : "🗄️"}</span>
          {archived ? i18n.chat.app.backToChats : t.archived(archivedCount)}
        </button>
      )}
      {visible.length === 0 ? (
        <div className="chat-list__empty">
          {query ? (
            <p className="muted">{t.noMatch}</p>
          ) : archived ? (
            <p className="muted">{t.noArchived}</p>
          ) : (
            <>
              <p><strong>{t.empty}</strong></p>
              <p className="muted">{t.emptyHint}</p>
              <Link to="/chat/personas" className="btn btn--sm">{i18n.chat.app.findPeople}</Link>
            </>
          )}
        </div>
      ) : (
        <ul className="chat-list" aria-label={archived ? t.archivedLabel : i18n.chat.app.chats}>
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
  const i18n = useT();
  const t = i18n.chat.list;
  const online = c.kind === "direct" && peer
    ? (() => {
      const p = chat.presences.find((x) => x.userId === peer.id);
      return p ? isOnline(p.lastSeenAt, chat.now) : false;
    })()
    : false;
  const typers = [...(chat.typing.get(c.id) ?? [])].filter(([, at]) => isTyping(at, chat.now)).map(([id]) => id);
  const last = c.lastMessage;
  const preview = typers.length
    ? c.kind === "group" ? t.typingGroup(chat.nameOf(typers[0])) : t.typing
    : last
      ? `${last.senderId === chat.me ? t.youPrefix : c.kind === "group" ? `${chat.nameOf(last.senderId)}: ` : ""}${messagePreview(last, 70)}`
      : t.startTalking;
  const when = last?.createdAt ?? c.lastMessageAt;
  const summary = [
    title,
    online ? i18n.chat.online : null,
    c.unread > 0 ? t.unread(c.unread) : null,
    c.pinnedAt ? t.pinned : null,
    c.muted ? t.muted : null,
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
              {c.muted && <span title={t.mutedTitle}>🔕</span>}
              {c.pinnedAt && <span title={t.pinnedTitle}>📌</span>}
              {c.unread > 0 && <span className="chat-item__badge">{c.unread > 99 ? "99+" : c.unread}</span>}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
