import { Link } from "react-router-dom";
import { buildCountdowns, countdownLabel } from "@/domain/dates";
import { PERMISSIONS } from "@/domain/permissions";
import { useAuth } from "@/state/AuthContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { AdminPage } from "./AdminLayout";

export default function PanelHome() {
  const { content } = useSiteContent();
  const { profile, policy } = useAuth();
  const { unreadByKind } = useNotifications();
  const next = buildCountdowns(content?.dates ?? []).slice(0, 3);
  const stats = [
    { label: "Fotos", value: content?.photos.length ?? 0, to: "/panel/fotos", icon: "📸", show: policy.can(PERMISSIONS.photosManage) },
    { label: "Hitos", value: content?.milestones.length ?? 0, to: "/panel/hitos", icon: "🌟", show: policy.can(PERMISSIONS.contentEdit) },
    { label: "Fechas", value: content?.dates.length ?? 0, to: "/panel/fechas", icon: "📅", show: policy.can(PERMISSIONS.datesManage) },
    { label: "Notitas sin leer", value: unreadByKind.note, to: "/mensajes", icon: "💌", show: policy.can(PERMISSIONS.notesSend) },
  ].filter((s) => s.show);

  return (
    <AdminPage title={`Hola${profile ? `, ${profile.displayName}` : ""} 💖`} description="Desde aquí puedes cuidar cada detalle de nuestra página.">
      <div className="stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="stat card card--interactive">
            <span className="stat__icon" aria-hidden>{s.icon}</span>
            <span className="stat__value">{s.value}</span>
            <span className="muted">{s.label}</span>
          </Link>
        ))}
      </div>
      {next.length > 0 && (
        <div className="card stack">
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Lo que se viene</h2>
          {next.map((c) => <div key={c.date.id}>{c.date.icon} {countdownLabel(c)}</div>)}
        </div>
      )}
      <div className="card row-between">
        <span>¿Quieres ver cómo quedó?</span>
        <Link className="btn btn--soft" to="/">Ver la página</Link>
      </div>
    </AdminPage>
  );
}
