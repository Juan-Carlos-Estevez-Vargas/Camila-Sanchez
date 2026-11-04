/**
 * La app de chat a pantalla completa: a la izquierda la bandeja (chats,
 * solicitudes y buscar personas) y a la derecha la conversación abierta.
 * En el celular se ve una cosa a la vez, como en cualquier app de mensajería.
 *
 *   /chat              bandeja
 *   /chat/solicitudes  solicitudes recibidas y enviadas
 *   /chat/personas     buscar personas para chatear
 *   /chat/:id          una conversación
 */
import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useNotifications } from "@/state/NotificationsContext";
import { EnableNotifications } from "@/features/messages/EnableNotifications";
import "@/features/messages/styles/messages.scss";
import "./styles/chat-app.scss";
import { ChatProvider, useChat } from "./ChatStore";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { PeoplePanel } from "./PeoplePanel";
import { RequestsPanel } from "./RequestsPanel";
import { useT } from "@/i18n";

type View = "chats" | "requests" | "people";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChatApp() {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
}

function ChatLayout() {
  const rest = useParams()["*"] ?? "";
  const conversationId = UUID.test(rest) ? rest : null;
  const view: View = rest === "solicitudes" ? "requests" : rest === "personas" ? "people" : "chats";
  const { incoming, ready, conversations, unreadTotal } = useChat();
  const i18n = useT();
  const t = i18n.chat.app;

  // En el celular, dentro de una conversación, la cabecera del sitio se
  // esconde y el chat ocupa toda la pantalla.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.chatApp = conversationId ? "thread" : "list";
    return () => {
      delete root.dataset.chatApp;
    };
  }, [conversationId]);

  // Los avisos que llevan a esta pantalla (solicitudes, o los del chat de
  // antes con enlace a /chat) quedan leídos al llegar aquí.
  const { pathname } = useLocation();
  const { items, markRead } = useNotifications();
  useEffect(() => {
    for (const n of items) if (!n.readAt && n.link === pathname) void markRead(n.id);
  }, [items, markRead, pathname]);

  const known = conversationId ? conversations.find((c) => c.id === conversationId) : undefined;

  return (
    <main id="contenido-principal" className={`chat-app${conversationId ? " has-thread" : ""}`} aria-label={t.label}>
      <aside className="chat-app__side" aria-label={t.side}>
        <header className="chat-side__header">
          <h1 className="chat-side__title">{t.title}</h1>
          <Link to="/chat/personas" className="btn btn--icon btn--ghost" aria-label={t.newChat} title={t.newChatTitle} data-tour="chat-new">
            <span aria-hidden>✏️</span>
          </Link>
        </header>
        <nav className="chat-side__tabs" aria-label={t.sections}>
          <Link to="/chat" className={`chat-side__tab${view === "chats" ? " is-active" : ""}`} aria-current={view === "chats" ? "page" : undefined} data-tour="chat-list">
            {t.chats}
            {unreadTotal > 0 && (
              <>
                <span className="counter-dot" aria-hidden>{unreadTotal > 99 ? "99+" : unreadTotal}</span>
                <span className="visually-hidden">{t.unread(unreadTotal)}</span>
              </>
            )}
          </Link>
          <Link to="/chat/solicitudes" className={`chat-side__tab${view === "requests" ? " is-active" : ""}`} aria-current={view === "requests" ? "page" : undefined} data-tour="chat-requests">
            {t.requests}
            {incoming.length > 0 && (
              <>
                <span className="counter-dot" aria-hidden>{incoming.length}</span>
                <span className="visually-hidden">{t.newRequests(incoming.length)}</span>
              </>
            )}
          </Link>
          <Link to="/chat/personas" className={`chat-side__tab${view === "people" ? " is-active" : ""}`} aria-current={view === "people" ? "page" : undefined}>
            {t.search}
          </Link>
        </nav>
        <EnableNotifications />
        <div className="chat-side__body">
          {view === "chats" && <ConversationList activeId={conversationId} />}
          {view === "requests" && <RequestsPanel />}
          {view === "people" && <PeoplePanel />}
        </div>
      </aside>
      <section className="chat-app__main" aria-label={t.conversation}>
        {conversationId ? (
          known ? <ConversationView key={conversationId} conversation={known} /> : (
            <div className="chat-app__placeholder">
              {ready ? (
                <>
                  <span className="chat-app__placeholder-icon" aria-hidden>🔒</span>
                  <h2>{t.unavailable}</h2>
                  <p className="muted">{t.unavailableHint}</p>
                  <Link to="/chat" className="btn btn--ghost">{t.backToChats}</Link>
                </>
              ) : <p className="muted" role="status">{i18n.common.loadingEllipsis}</p>}
            </div>
          )
        ) : (
          <div className="chat-app__placeholder">
            <span className="chat-app__placeholder-icon" aria-hidden>💬</span>
            <h2>{t.placeholderTitle}</h2>
            <p className="muted">{t.placeholderHint}</p>
            <Link to="/chat/personas" className="btn">{t.findPeople}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
