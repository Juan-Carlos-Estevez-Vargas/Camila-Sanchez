import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link, NavLink } from "react-router-dom";
import { safeNextPath } from "@/core/safeRedirect";
import { formatRelative } from "@/domain/dates";
import { PERMISSIONS } from "@/domain/permissions";
import { GuidedTour } from "@/features/tour/GuidedTour";
import { useAuth } from "@/state/AuthContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { Avatar } from "@/ui/Avatar";

/** Cierra un desplegable con Esc (devolviendo el foco a su botón) o con un clic fuera. */
function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close, root, trigger]);
}

/** Contador visible para todos y dicho en palabras para el lector de pantalla. */
function Unread({ count, label = "sin leer", dot }: { count: number; label?: string; dot?: boolean }) {
  if (count <= 0) return null;
  return (
    <>
      <span className="counter-dot" aria-hidden>{dot ? "•" : count > 99 ? "99+" : count}</span>
      <span className="visually-hidden">{dot ? `(${label})` : `(${count} ${label})`}</span>
    </>
  );
}

function NotificationBell() {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, close, root, trigger);
  return (
    <div className="bell" data-tour="bell" ref={root}>
      <button ref={trigger} className="btn btn--icon btn--ghost" aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="counter-dot bell__dot" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell__panel card" id={panelId} role="region" aria-labelledby={titleId}>
          <div className="row-between">
            <h2 className="bell__heading" id={titleId}>Notificaciones</h2>
            {unread > 0 && <button className="btn btn--sm btn--ghost" onClick={() => void markAllRead()}>Marcar todo leído</button>}
          </div>
          {items.length === 0 && <p className="muted" style={{ margin: "12px 0 0" }}>Nada nuevo por ahora 💤</p>}
          <ul className="bell__list">
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "is-unread"}>
                <Link to={safeNextPath(n.link)} onClick={() => { setOpen(false); void markRead(n.id); }}>
                  {!n.readAt && <span className="visually-hidden">Nueva: </span>}
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
  const burger = useRef<HTMLButtonElement>(null);
  const navRoot = useRef<HTMLDivElement>(null);
  const closeMenu = useRef(() => setMenu(false)).current;
  useDismiss(menu, closeMenu, navRoot, burger);
  const title = content?.settings.siteTitle.replace(/\p{Extended_Pictographic}/gu, "").trim() || "Nuestro rincón";
  const close = () => setMenu(false);

  return (
    <header className="app-header">
      <div className="container app-header__inner" ref={navRoot}>
        <Link to="/" className="brand" data-tour="brand" onClick={close}>
          <span className="brand__mark" aria-hidden>♥</span>
          <span className="brand__name">{title}</span>
        </Link>
        <button ref={burger} className="btn btn--icon btn--ghost app-header__burger" data-tour="menu" aria-label="Menú principal"
          aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu((m) => !m)}><span aria-hidden>☰</span></button>
        <nav id="menu-principal" className={`app-nav${menu ? " is-open" : ""}`} aria-label="Principal">
          <NavLink to="/" end onClick={close}>Inicio</NavLink>
          {user && policy.can(PERMISSIONS.notesSend) && (
            <NavLink to="/mensajes" data-tour="nav-mensajes" onClick={close}>
              Cajita <Unread count={unreadByKind.note} label="notitas sin leer" />
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.chatUse) && (
            <NavLink to="/chat" data-tour="nav-chat" onClick={close}>
              Chat <Unread count={unreadByKind.chat} label="mensajes nuevos" dot />
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.listsUse) && (
            <NavLink to="/listas" data-tour="nav-listas" onClick={close}>
              Listas <Unread count={unreadByKind.list} label="novedades" />
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
