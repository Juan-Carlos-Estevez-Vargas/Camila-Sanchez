import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DEFAULT_THEME } from "@/domain/defaults";
import { personalTheme } from "@/domain/palettes";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { NotificationsProvider } from "@/state/NotificationsContext";
import { PresenceHeartbeat } from "@/state/PresenceHeartbeat";
import { SeoController } from "@/state/SeoController";
import { SiteContentProvider, useSiteContent } from "@/state/SiteContentStore";
import { ThemeController } from "@/state/ThemeController";
import { ToastProvider } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { ErrorBoundary } from "./ErrorBoundary";
import { appRoutes } from "./routes";

const SitePage = lazy(() => import("@/features/site/SitePage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const InvitePage = lazy(() => import("@/features/auth/InvitePage"));
const RecoverPage = lazy(() => import("@/features/auth/RecoverPage"));

function ThemedShell() {
  const { content } = useSiteContent();
  const { profile } = useAuth();
  // Quien entra sin cuenta ve los colores de la página; cada persona, los suyos.
  const siteTheme = content?.settings.theme ?? DEFAULT_THEME;
  const theme = useMemo(() => personalTheme(siteTheme, profile?.themeColors), [siteTheme, profile?.themeColors]);
  return (
    <>
      <ThemeController theme={theme} />
      <SeoController />
      <PresenceHeartbeat />
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>
      <AppHeader />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SitePage />} />
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/invitacion" element={<InvitePage />} />
            <Route path="/recuperar" element={<RecoverPage />} />
            {appRoutes}
            <Route path="*" element={<EmptyState icon="🧭" title="Esta página no existe" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <AppFooter />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SiteContentProvider>
            <NotificationsProvider>
              <ThemedShell />
            </NotificationsProvider>
          </SiteContentProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
