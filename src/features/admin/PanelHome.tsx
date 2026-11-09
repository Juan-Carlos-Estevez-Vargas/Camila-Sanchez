import { Link } from "react-router-dom";
import { buildCountdowns, countdownLabel } from "@/domain/dates";
import { countdownDates } from "@/domain/relationship";
import { PERMISSIONS } from "@/domain/permissions";
import { useAuth } from "@/state/AuthContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { AdminPage } from "./AdminLayout";
import { useT } from "@/i18n";

export default function PanelHome() {
  const { content } = useSiteContent();
  const { profile, policy } = useAuth();
  const { unreadByKind } = useNotifications();
  const t = useT().admin.home;
  const next = buildCountdowns(content ? countdownDates(content.dates, content.settings) : []).slice(0, 3);
  const stats = [
    { label: t.photos, value: content?.photos.length ?? 0, to: "/panel/fotos", icon: "📸", show: policy.can(PERMISSIONS.photosManage) },
    { label: t.milestones, value: content?.milestones.length ?? 0, to: "/panel/hitos", icon: "🌟", show: policy.can(PERMISSIONS.contentEdit) },
    { label: t.dates, value: content?.dates.length ?? 0, to: "/panel/fechas", icon: "📅", show: policy.can(PERMISSIONS.datesManage) },
    { label: t.unreadNotes, value: unreadByKind.note, to: "/mensajes", icon: "💌", show: policy.can(PERMISSIONS.notesSend) },
  ].filter((s) => s.show);

  return (
    <AdminPage title={t.hello(profile?.displayName ?? null)} description={t.description}>
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
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{t.upcoming}</h2>
          {next.map((c) => <div key={c.date.id}>{c.date.icon} {countdownLabel(c)}</div>)}
        </div>
      )}
      <div className="card row-between">
        <span>{t.seeIt}</span>
        <Link className="btn btn--soft" to="/">{t.viewPage}</Link>
      </div>
    </AdminPage>
  );
}
