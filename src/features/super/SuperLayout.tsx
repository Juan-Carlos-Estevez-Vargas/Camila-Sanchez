import { PERMISSIONS } from "@/domain/permissions";
import { AdminLayout, type AdminNavItem } from "@/features/admin/AdminLayout";
import { msg, useT } from "@/i18n";

const items = (): AdminNavItem[] => {
  const t = msg().superAdmin.nav;
  return [
    { to: "/super", label: t.home, icon: "🧭", end: true, visible: (p) => p.canUseSuperPanel },
    { to: "/super/usuarios", label: t.users, icon: "👥", visible: (p) => p.can(PERMISSIONS.usersManage) },
    { to: "/super/permisos", label: t.roles, icon: "🔐", visible: (p) => p.can(PERMISSIONS.usersManage) },
    { to: "/super/apariencia", label: t.theme, icon: "🎨", visible: (p) => p.can(PERMISSIONS.themeManage) },
    { to: "/super/secciones", label: t.sections, icon: "🧩", visible: (p) => p.can(PERMISSIONS.sectionsManage) },
    { to: "/super/ajustes", label: t.settings, icon: "⚙️", visible: (p) => p.can(PERMISSIONS.settingsManage) },
    { to: "/super/auditoria", label: t.audit, icon: "📜", visible: (p) => p.can(PERMISSIONS.auditView) },
    { to: "/panel", label: t.content, icon: "✍️", end: true, visible: (p) => p.canUseContentPanel },
  ];
};

/** Panel del super administrador. */
export default function SuperLayout() {
  const t = useT().superAdmin;
  return <AdminLayout title={t.title} subtitle={t.subtitle} items={items()} />;
}
