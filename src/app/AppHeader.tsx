import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link, NavLink } from "react-router-dom";
import { safeNextPath } from "@/core/safeRedirect";
import { formatRelative } from "@/domain/dates";
import { PERMISSIONS } from "@/domain/permissions";
import { GuidedTour } from "@/features/tour/GuidedTour";
import { useAuth } from "@/state/AuthContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useLocalizedContent } from "@/state/SiteContentStore";
import { Avatar } from "@/ui/Avatar";
import { useT } from "@/i18n";
import { LanguagePicker } from "./LanguagePicker";
import { DonateLink } from "./DonateLink";

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
function Unread({ count, label, dot }: { count: number; label?: string; dot?: boolean }) {
  const t = useT();
  if (count <= 0) return null;
  label ??= t.app.header.unread;
  return (
    <>
      <span className="counter-dot" aria-hidden>{dot ? "•" : count > 99 ? "99+" : count}</span>
      <span className="visually-hidden">{dot ? `(${label})` : `(${count} ${label})`}</span>
    </>
  );
}

function NotificationBell() {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const common = useT().common;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, close, root, trigger);
  const t = useT().app.header;
  return (
    <div className="bell" data-tour="bell" ref={root}>
      <button ref={trigger} className="btn btn--icon btn--ghost" aria-label={unread > 0 ? t.notificationsUnread(unread) : t.notifications}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="counter-dot bell__dot" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell__panel card" id={panelId} role="region" aria-labelledby={titleId}>
          <div className="row-between">
            <h2 className="bell__heading" id={titleId}>{t.notifications}</h2>
            {unread > 0 && <button className="btn btn--sm btn--ghost" onClick={() => void markAllRead()}>{t.markAllRead}</button>}
          </div>
          {items.length === 0 && <p className="muted" style={{ margin: "12px 0 0" }}>{t.nothingNew}</p>}
          <ul className="bell__list">
            {items.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "is-unread"}>
                <Link to={safeNextPath(n.link)} onClick={() => { setOpen(false); void markRead(n.id); }}>
                  {!n.readAt && <span className="visually-hidden">{common.newBadge}</span>}
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

/** Menú de la cuenta: la foto abre «Mi cuenta» y «Salir». */
function AccountMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, close, root, trigger);
  const t = useT().app.header;
  const name = profile?.displayName ?? "";
  return (
    <div className="account-menu" ref={root}>
      <button ref={trigger} type="button" className="account-menu__trigger" data-tour="nav-cuenta"
        aria-label={t.accountMenu(name)} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <Avatar person={profile} size={32} />
      </button>
      {open && (
        <div className="account-menu__panel card" id={panelId}>
          {name && <p className="account-menu__name">{name}</p>}
          <Link to="/cuenta" className="account-menu__item" onClick={close}><span aria-hidden>👤</span> {t.account}</Link>
          <button type="button" className="account-menu__item" onClick={() => { close(); void signOut(); }}>
            <span aria-hidden>↩</span> {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const { user, policy } = useAuth();
  const { unreadByKind } = useNotifications();
  const { content } = useLocalizedContent();
  const [menu, setMenu] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const navRoot = useRef<HTMLDivElement>(null);
  const closeMenu = useRef(() => setMenu(false)).current;
  useDismiss(menu, closeMenu, navRoot, burger);
  const i18n = useT();
  const t = i18n.app.header;
  const title = content?.settings.siteTitle.replace(/\p{Extended_Pictographic}/gu, "").trim() || i18n.app.siteTitle;
  const close = () => setMenu(false);

  return (
    <header className="app-header">
      <div className="app-header__inner" ref={navRoot}>
        <Link to="/" className="brand" data-tour="brand" onClick={close} title={title}>
          <span className="brand__mark" aria-hidden>♥</span>
          <span className="brand__name">{title}</span>
        </Link>
        <nav id="menu-principal" className={`app-nav${menu ? " is-open" : ""}`} aria-label={t.nav}>
          <NavLink to="/" end onClick={close}>{t.home}</NavLink>
          {user && policy.can(PERMISSIONS.notesSend) && (
            <NavLink to="/mensajes" data-tour="nav-mensajes" onClick={close}>
              {t.notes} <Unread count={unreadByKind.note} label={t.notesUnread} />
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.chatUse) && (
            <NavLink to="/chat" data-tour="nav-chat" onClick={close}>
              {t.chat} <Unread count={unreadByKind.chat} label={t.chatUnread} dot />
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.listsUse) && (
            <NavLink to="/listas" data-tour="nav-listas" onClick={close}>
              {t.lists} <Unread count={unreadByKind.list} label={t.listsUnread} />
            </NavLink>
          )}
          {user && policy.can(PERMISSIONS.dedicationsUse) && (
            <NavLink to="/dedicatorias" data-tour="nav-dedicatorias" onClick={close}>
              {t.dedications} <Unread count={unreadByKind.dedication} label={t.dedicationsUnread} />
            </NavLink>
          )}
          {policy.canUseContentPanel && <NavLink to="/panel" data-tour="nav-panel" onClick={close}>{t.panel}</NavLink>}
          {policy.canUseSuperPanel && <NavLink to="/super" data-tour="nav-super" onClick={close}>{t.super}</NavLink>}
        </nav>
        <div className="app-header__actions">
          <LanguagePicker compact />
          <DonateLink variant="header" />
          <GuidedTour />
          {user && <NotificationBell />}
          {user
            ? <AccountMenu />
            : <NavLink to="/entrar" className="btn btn--sm" data-tour="nav-entrar" onClick={close}>{t.signIn}</NavLink>}
          <button ref={burger} className="btn btn--icon btn--ghost app-header__burger" data-tour="menu" aria-label={t.menu}
            aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu((m) => !m)}><span aria-hidden>☰</span></button>
        </div>
      </div>
    </header>
  );
}
