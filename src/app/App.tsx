import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
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
import { RouteAnnouncer, SkipLink } from "./RouteAnnouncer";
import { appRoutes } from "./routes";

const SitePage = lazy(() => import("@/features/site/SitePage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const InvitePage = lazy(() => import("@/features/auth/InvitePage"));
const RecoverPage = lazy(() => import("@/features/auth/RecoverPage"));

function NotFound() {
  return (
    <main id="contenido-principal" className="container">
      <EmptyState icon="🧭" title="Esta página no existe" heading>
        <Link className="btn" to="/">Volver al inicio</Link>
      </EmptyState>
    </main>
  );
}

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
      <SkipLink />
      <RouteAnnouncer />
      <AppHeader />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SitePage />} />
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/invitacion" element={<InvitePage />} />
            <Route path="/recuperar" element={<RecoverPage />} />
            {appRoutes}
            <Route path="*" element={<NotFound />} />
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
