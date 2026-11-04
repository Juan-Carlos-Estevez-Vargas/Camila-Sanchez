import { PERMISSIONS } from "@/domain/permissions";
import { AdminLayout, type AdminNavItem } from "./AdminLayout";
import { msg, useT } from "@/i18n";

/** Menú del panel de contenido; los nombres salen del idioma actual. */
export function panelItems(): AdminNavItem[] {
  const t = msg().admin.nav;
  return [
    { to: "/panel", label: t.home, icon: "🏠", end: true, visible: (p) => p.canUseContentPanel },
    { to: "/panel/fotos", label: t.photos, icon: "📸", visible: (p) => p.can(PERMISSIONS.photosManage) },
    { to: "/panel/textos", label: t.texts, icon: "✍️", visible: (p) => p.can(PERMISSIONS.contentEdit) },
    { to: "/panel/hitos", label: t.milestones, icon: "🌟", visible: (p) => p.can(PERMISSIONS.contentEdit) },
    { to: "/panel/fechas", label: t.dates, icon: "📅", visible: (p) => p.can(PERMISSIONS.datesManage) },
    { to: "/panel/sorpresas", label: t.surprises, icon: "🎁", visible: (p) => p.can(PERMISSIONS.interruptionsManage) },
  ];
}

/** Panel de contenido (el de Camila). */
export default function PanelLayout() {
  const t = useT().admin;
  return <AdminLayout title={t.panelTitle} subtitle={t.panelSubtitle} items={panelItems()} />;
}
