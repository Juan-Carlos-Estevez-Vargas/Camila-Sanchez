/**
 * Rutas privadas. Cada área se carga de forma diferida (code splitting):
 * quien sólo visita la página nunca descarga el código de los paneles.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { PERMISSIONS } from "@/domain/permissions";

const PanelLayout = lazy(() => import("@/features/admin/PanelLayout"));
const PanelHome = lazy(() => import("@/features/admin/PanelHome"));
const PhotosAdmin = lazy(() => import("@/features/admin/PhotosAdmin"));
const TextsAdmin = lazy(() => import("@/features/admin/TextsAdmin"));
const MilestonesAdmin = lazy(() => import("@/features/admin/MilestonesAdmin"));
const DatesAdmin = lazy(() => import("@/features/admin/DatesAdmin"));
const InterruptionsAdmin = lazy(() => import("@/features/admin/InterruptionsAdmin"));
const MessagesPage = lazy(() => import("@/features/messages/MessagesPage"));
const ChatPage = lazy(() => import("@/features/chat/ChatPage"));
const ListsPage = lazy(() => import("@/features/lists/ListsPage"));
const ListPage = lazy(() => import("@/features/lists/ListPage"));
const AccountPage = lazy(() => import("@/features/auth/AccountPage"));
const MyColorsPage = lazy(() => import("@/features/auth/MyColorsPage"));
const SuperLayout = lazy(() => import("@/features/super/SuperLayout"));
const SuperHome = lazy(() => import("@/features/super/SuperHome"));
const UsersAdmin = lazy(() => import("@/features/super/UsersAdmin"));
const RolesAdmin = lazy(() => import("@/features/super/RolesAdmin"));
const ThemeAdmin = lazy(() => import("@/features/super/ThemeAdmin"));
const SectionsManager = lazy(() => import("@/features/super/SectionsManager"));
const SettingsAdmin = lazy(() => import("@/features/super/SettingsAdmin"));
const AuditAdmin = lazy(() => import("@/features/super/AuditAdmin"));

export const appRoutes = (
  <>
    <Route path="/mensajes" element={<RequirePermission check={(p) => p.can(PERMISSIONS.notesSend)}><MessagesPage /></RequirePermission>} />
    <Route path="/cuenta" element={<RequirePermission check={() => true}><AccountPage /></RequirePermission>} />
    <Route path="/cuenta/colores" element={<RequirePermission check={() => true}><MyColorsPage /></RequirePermission>} />
    <Route path="/chat" element={<RequirePermission check={(p) => p.can(PERMISSIONS.chatUse)}><ChatPage /></RequirePermission>} />
    <Route path="/listas" element={<RequirePermission check={(p) => p.can(PERMISSIONS.listsUse)}><ListsPage /></RequirePermission>} />
    <Route path="/listas/:id" element={<RequirePermission check={(p) => p.can(PERMISSIONS.listsUse)}><ListPage /></RequirePermission>} />
    <Route path="/panel" element={<RequirePermission check={(p) => p.canUseContentPanel}><PanelLayout /></RequirePermission>}>
      <Route index element={<PanelHome />} />
      <Route path="fotos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.photosManage)}><PhotosAdmin /></RequirePermission>} />
      <Route path="textos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.contentEdit)}><TextsAdmin /></RequirePermission>} />
      <Route path="hitos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.contentEdit)}><MilestonesAdmin /></RequirePermission>} />
      <Route path="fechas" element={<RequirePermission check={(p) => p.can(PERMISSIONS.datesManage)}><DatesAdmin /></RequirePermission>} />
      <Route path="sorpresas" element={<RequirePermission check={(p) => p.can(PERMISSIONS.interruptionsManage)}><InterruptionsAdmin /></RequirePermission>} />
      {/* Los colores ahora son de cada persona: viven en Mi cuenta. */}
      <Route path="colores" element={<Navigate to="/cuenta/colores" replace />} />
    </Route>
    <Route path="/super" element={<RequirePermission check={(p) => p.canUseSuperPanel}><SuperLayout /></RequirePermission>}>
      <Route index element={<SuperHome />} />
      <Route path="usuarios" element={<RequirePermission check={(p) => p.can(PERMISSIONS.usersManage)}><UsersAdmin /></RequirePermission>} />
      <Route path="permisos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.usersManage)}><RolesAdmin /></RequirePermission>} />
      <Route path="apariencia" element={<RequirePermission check={(p) => p.can(PERMISSIONS.themeManage)}><ThemeAdmin /></RequirePermission>} />
      <Route path="secciones" element={<RequirePermission check={(p) => p.can(PERMISSIONS.sectionsManage)}><SectionsManager /></RequirePermission>} />
      <Route path="ajustes" element={<RequirePermission check={(p) => p.can(PERMISSIONS.settingsManage)}><SettingsAdmin /></RequirePermission>} />
      <Route path="auditoria" element={<RequirePermission check={(p) => p.can(PERMISSIONS.auditView)}><AuditAdmin /></RequirePermission>} />
    </Route>
  </>
);
