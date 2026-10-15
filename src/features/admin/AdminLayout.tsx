import { NavLink, Outlet } from "react-router-dom";
import "@/styles/admin.css";
import type { AccessPolicy } from "@/domain/permissions";
import { useAuth } from "@/state/AuthContext";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: string;
  visible(policy: AccessPolicy): boolean;
  end?: boolean;
}

/** Estructura común de los dos paneles: menú lateral filtrado por permisos. */
export function AdminLayout({ title, subtitle, items }: { title: string; subtitle: string; items: AdminNavItem[] }) {
  const { policy, profile } = useAuth();
  const visible = items.filter((i) => i.visible(policy));
  return (
    <div className="admin container">
      <aside className="admin__side">
        <div className="admin__title">
          <strong>{title}</strong>
          <span className="muted">{subtitle}{profile ? ` · ${profile.displayName}` : ""}</span>
        </div>
        <nav className="admin__nav" aria-label={title}>
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span aria-hidden>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="contenido-principal" className="admin__main">
        <Outlet />
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
