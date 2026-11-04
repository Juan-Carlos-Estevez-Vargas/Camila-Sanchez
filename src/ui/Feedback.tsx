import type { ReactNode } from "react";
import { useT } from "@/i18n";

export function Spinner({ label }: { label?: string }) {
  const t = useT();
  return <div className="spinner" role="status" aria-label={label ?? t.common.loading} />;
}

export function PageLoader() {
  const t = useT();
  return (
    <div className="page-loader" role="status">
      <div className="love-loader__heart" style={{ position: "static", fontSize: "2.5rem" }} aria-hidden>💗</div>
      <span className="visually-hidden">{t.common.loadingEllipsis}</span>
    </div>
  );
}

/** Estado vacío. Con `heading` el título es el <h1> de la página (p. ej. el 404). */
export function EmptyState({ icon = "🌷", title, heading, children }: { icon?: string; title: string; heading?: boolean; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>{icon}</div>
      {heading ? <h1 className="empty__title">{title}</h1> : <strong>{title}</strong>}
      {children}
    </div>
  );
}
