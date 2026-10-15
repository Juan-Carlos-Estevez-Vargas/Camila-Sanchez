import type { ReactNode } from "react";

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label} />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="love-loader__heart" style={{ position: "static", fontSize: "2.5rem" }} aria-label="Cargando">💗</div>
    </div>
  );
}

export function EmptyState({ icon = "🌷", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>{icon}</div>
      <strong>{title}</strong>
      {children}
    </div>
  );
}
