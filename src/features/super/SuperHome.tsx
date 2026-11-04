import { Link } from "react-router-dom";
import { useBackend } from "@/state/BackendContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useAsync } from "@/ui/useAsync";
import { useT } from "@/i18n";

export default function SuperHome() {
  const backend = useBackend();
  const { content } = useSiteContent();
  const { data: users } = useAsync(() => backend.users.listProfiles(), [backend]);
  const i18n = useT();
  const t = i18n.superAdmin.home;
  const cards = [
    { to: "/super/usuarios", icon: "👥", value: users?.length ?? "…", label: t.users },
    { to: "/super/secciones", icon: "🧩", value: content?.sections.length ?? "…", label: t.sections },
    { to: "/panel/fotos", icon: "📸", value: content?.photos.length ?? "…", label: t.photos },
    { to: "/super/ajustes", icon: content?.settings.isPublic ? "🌍" : "🔒", value: content?.settings.isPublic ? t.public : t.private, label: t.visibility },
  ];
  return (
    <AdminPage title={i18n.superAdmin.title} description={t.description}>
      {backend.mode === "demo" && (
        <div className="card" style={{ borderColor: "var(--c-warning)" }}>
          <strong>{t.demoTitle}</strong> {t.demoBody}
        </div>
      )}
      <div className="stats">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="stat card card--interactive">
            <span className="stat__icon" aria-hidden>{c.icon}</span>
            <span className="stat__value">{c.value}</span>
            <span className="muted">{c.label}</span>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
