import { Link } from "react-router-dom";
import { useBackend } from "@/state/BackendContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useAsync } from "@/ui/useAsync";

export default function SuperHome() {
  const backend = useBackend();
  const { content } = useSiteContent();
  const { data: users } = useAsync(() => backend.users.listProfiles(), [backend]);
  const cards = [
    { to: "/super/usuarios", icon: "👥", value: users?.length ?? "…", label: "Usuarios" },
    { to: "/super/secciones", icon: "🧩", value: content?.sections.length ?? "…", label: "Secciones" },
    { to: "/panel/fotos", icon: "📸", value: content?.photos.length ?? "…", label: "Fotos" },
    { to: "/super/ajustes", icon: content?.settings.isPublic ? "🌍" : "🔒", value: content?.settings.isPublic ? "Pública" : "Privada", label: "Visibilidad" },
  ];
  return (
    <AdminPage title="Administración" description="Control total del sitio: usuarios, permisos, apariencia y estructura.">
      {backend.mode === "demo" && (
        <div className="card" style={{ borderColor: "var(--c-warning)" }}>
          <strong>Modo demo.</strong> Los datos se guardan sólo en este navegador. Conecta Supabase (ver README) para usarlo de verdad.
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
