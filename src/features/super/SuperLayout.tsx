import { PERMISSIONS } from "@/domain/permissions";
import { AdminLayout, type AdminNavItem } from "@/features/admin/AdminLayout";

const ITEMS: AdminNavItem[] = [
  { to: "/super", label: "Resumen", icon: "🧭", end: true, visible: (p) => p.canUseSuperPanel },
  { to: "/super/usuarios", label: "Usuarios", icon: "👥", visible: (p) => p.can(PERMISSIONS.usersManage) },
  { to: "/super/permisos", label: "Roles y permisos", icon: "🔐", visible: (p) => p.can(PERMISSIONS.usersManage) },
  { to: "/super/apariencia", label: "Apariencia", icon: "🎨", visible: (p) => p.can(PERMISSIONS.themeManage) },
  { to: "/super/secciones", label: "Secciones", icon: "🧩", visible: (p) => p.can(PERMISSIONS.sectionsManage) },
  { to: "/super/ajustes", label: "Ajustes del sitio", icon: "⚙️", visible: (p) => p.can(PERMISSIONS.settingsManage) },
  { to: "/super/auditoria", label: "Auditoría", icon: "📜", visible: (p) => p.can(PERMISSIONS.auditView) },
  { to: "/panel", label: "Panel de contenido", icon: "✍️", end: true, visible: (p) => p.canUseContentPanel },
];

/** Panel del super administrador. */
export default function SuperLayout() {
  return <AdminLayout title="Administración" subtitle="Super administrador" items={ITEMS} />;
}
