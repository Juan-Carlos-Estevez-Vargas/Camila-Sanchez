import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { formatRelative } from "@/domain/dates";
import { PERMISSIONS } from "@/domain/permissions";
import { GuidedTour } from "@/features/tour/GuidedTour";
import { useAuth } from "@/state/AuthContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { Avatar } from "@/ui/Avatar";

function NotificationBell() {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <div className="bell" data-tour="bell">
      <button className="btn btn--icon btn--ghost" aria-label={`Notificaciones (${unread} sin leer)`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="counter-dot bell__dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell__panel card" role="menu">
          <div className="row-between">
            <strong>Notificaciones</strong>
            {unread > 0 && <button className="btn btn--sm btn--ghost" onClick={() => void markAllRead()}>Marcar todo leído</button>}
          </div>
          {items.length === 0 && <p className="muted" style={{ margin: "12px 0 0" }}>Nada nuevo por ahora 💤</p>}
          <ul className="bell__list">
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "is-unread"}>
                <Link to={n.link ?? "/"} onClick={() => { setOpen(false); void markRead(n.id); }}>
                  <span className="bell__title">{n.title}</span>
                  {n.body && <span className="bell__body">{n.body}</span>}
                  <span className="bell__time">{formatRelative(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const { user, profile, policy, signOut } = useAuth();
  const { unreadByKind } = useNotifications();
  const { content } = useSiteContent();
  const [menu, setMenu] = useState(false);
  const title = content?.settings.siteTitle.replace(/\p{Extended_Pictographic}/gu, "").trim() || "Nuestro rincón";
  const close = () => setMenu(false);

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <Link to="/" className="brand" data-tour="brand" onClick={close}>
          <span className="brand__mark" aria-hidden>♥</span>
          <span className="brand__name">{title}</span>
        </Link>
        <button className="btn btn--icon btn--ghost app-header__burger" data-tour="menu" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>☰</button>
        <nav className={`app-nav${menu ? " is-open" : ""}`} aria-label="Principal">
          <NavLink to="/" end onClick={close}>Inicio</NavLink>
          {user && policy.can(PERMISSIONS.notesSend) && (
            <NavLink to="/mensajes" data-tour="nav-mensajes" onClick={close}>
              Cajita {unreadByKind.note > 0 && <span className="counter-dot">{unreadByKind.note}</span>}
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.chatUse) && (
            <NavLink to="/chat" data-tour="nav-chat" onClick={close}>
              Chat {unreadByKind.chat > 0 && <span className="counter-dot">•</span>}
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.listsUse) && (
            <NavLink to="/listas" data-tour="nav-listas" onClick={close}>
              Listas {unreadByKind.list > 0 && <span className="counter-dot">{unreadByKind.list}</span>}
            </NavLink>
          )}
          {policy.canUseContentPanel && <NavLink to="/panel" data-tour="nav-panel" onClick={close}>Mi panel</NavLink>}
          {policy.canUseSuperPanel && <NavLink to="/super" data-tour="nav-super" onClick={close}>Administración</NavLink>}
          {user && <NavLink to="/cuenta" data-tour="nav-cuenta" className="nav-account" onClick={close}><Avatar person={profile} size={24} />Mi cuenta</NavLink>}
          {user ? (
            <button className="btn btn--sm btn--ghost" onClick={() => { close(); void signOut(); }}>
              Salir{profile ? ` (${profile.displayName})` : ""}
            </button>
          ) : (
            <NavLink to="/entrar" className="btn btn--sm" data-tour="nav-entrar" onClick={close}>Entrar</NavLink>
          )}
        </nav>
        <GuidedTour />
        {user && <NotificationBell />}
      </div>
    </header>
  );
}
