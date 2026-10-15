import { PERMISSIONS } from "@/domain/permissions";
import { AdminLayout, type AdminNavItem } from "./AdminLayout";

export const PANEL_ITEMS: AdminNavItem[] = [
  { to: "/panel", label: "Inicio", icon: "🏠", end: true, visible: (p) => p.canUseContentPanel },
  { to: "/panel/fotos", label: "Fotos", icon: "📸", visible: (p) => p.can(PERMISSIONS.photosManage) },
  { to: "/panel/textos", label: "Textos y animaciones", icon: "✍️", visible: (p) => p.can(PERMISSIONS.contentEdit) },
  { to: "/panel/hitos", label: "Hitos", icon: "🌟", visible: (p) => p.can(PERMISSIONS.contentEdit) },
  { to: "/panel/fechas", label: "Fechas importantes", icon: "📅", visible: (p) => p.can(PERMISSIONS.datesManage) },
  { to: "/panel/sorpresas", label: "Sorpresas", icon: "🎁", visible: (p) => p.can(PERMISSIONS.interruptionsManage) },
  { to: "/panel/colores", label: "Colores", icon: "🎨", visible: (p) => p.can(PERMISSIONS.themePalette) },
];

/** Panel de contenido (el de Camila). */
export default function PanelLayout() {
  return <AdminLayout title="Mi panel" subtitle="Contenido" items={PANEL_ITEMS} />;
}
