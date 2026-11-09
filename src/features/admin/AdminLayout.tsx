import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import "./styles/admin.scss";
import type { AccessPolicy } from "@/domain/permissions";
import { useAuth } from "@/state/AuthContext";
import { PageLoader } from "@/ui/Feedback";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: string;
  visible(policy: AccessPolicy): boolean;
  end?: boolean;
}

/**
 * Estructura común de los paneles y de Mi cuenta: menú lateral (filtrado por
 * permisos) y la opción elegida en el centro. En el celular el menú pasa a una
 * fila de pestañas. `header` reemplaza el título (Mi cuenta muestra la foto).
 */
export function AdminLayout({ title, subtitle, items, header, navTour = "admin-nav" }: {
  title: string;
  subtitle: string;
  items: AdminNavItem[];
  header?: ReactNode;
  navTour?: string;
}) {
  const { policy, profile } = useAuth();
  const visible = items.filter((i) => i.visible(policy));
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // En el celular el menú es una fila que se desplaza: la opción abierta se
  // centra para que siempre se vea cuál es (sin mover la página).
  useEffect(() => {
    const row = nav.current;
    const active = row?.querySelector<HTMLElement>("a.active");
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += active.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <div className="admin container">
      <aside className="admin__side">
        {header ?? (
          <div className="admin__title">
            <strong>{title}</strong>
            <span className="muted">{subtitle}{profile ? ` · ${profile.displayName}` : ""}</span>
          </div>
        )}
        <nav ref={nav} className="admin__nav" aria-label={title} data-tour={navTour}>
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span aria-hidden>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="contenido-principal" className="admin__main" data-tour="admin-main">
        {/* Al cambiar de opción sólo carga el centro; el menú se queda. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export function AdminPage({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1 className="admin-page__title">{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
