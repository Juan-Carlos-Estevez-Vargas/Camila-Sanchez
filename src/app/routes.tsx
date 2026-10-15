/**
 * Rutas privadas. Cada área se carga de forma diferida (code splitting):
 * quien sólo visita la página nunca descarga el código de los paneles.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { RequirePermission } from "@/features/auth/RequirePermission";
import { PERMISSIONS } from "@/domain/permissions";

const PanelLayout = lazy(() => import("@/features/admin/PanelLayout"));
const PanelHome = lazy(() => import("@/features/admin/PanelHome"));
const PhotosAdmin = lazy(() => import("@/features/admin/PhotosAdmin"));
const TextsAdmin = lazy(() => import("@/features/admin/TextsAdmin"));
const MilestonesAdmin = lazy(() => import("@/features/admin/MilestonesAdmin"));
const DatesAdmin = lazy(() => import("@/features/admin/DatesAdmin"));
const InterruptionsAdmin = lazy(() => import("@/features/admin/InterruptionsAdmin"));

export const appRoutes = (
  <>
    <Route path="/panel" element={<RequirePermission check={(p) => p.canUseContentPanel}><PanelLayout /></RequirePermission>}>
      <Route index element={<PanelHome />} />
      <Route path="fotos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.photosManage)}><PhotosAdmin /></RequirePermission>} />
      <Route path="textos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.contentEdit)}><TextsAdmin /></RequirePermission>} />
      <Route path="hitos" element={<RequirePermission check={(p) => p.can(PERMISSIONS.contentEdit)}><MilestonesAdmin /></RequirePermission>} />
      <Route path="fechas" element={<RequirePermission check={(p) => p.can(PERMISSIONS.datesManage)}><DatesAdmin /></RequirePermission>} />
      <Route path="sorpresas" element={<RequirePermission check={(p) => p.can(PERMISSIONS.interruptionsManage)}><InterruptionsAdmin /></RequirePermission>} />
    </Route>
  </>
);
