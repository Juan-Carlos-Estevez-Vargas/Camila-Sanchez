import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/state/AuthContext";
import { NotificationsProvider } from "@/state/NotificationsContext";
import { SiteContentProvider, useSiteContent } from "@/state/SiteContentStore";
import { ThemeController } from "@/state/ThemeController";
import { ToastProvider } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { AppHeader } from "./AppHeader";
import { ErrorBoundary } from "./ErrorBoundary";
import { appRoutes } from "./routes";

const SitePage = lazy(() => import("@/features/site/SitePage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));

function ThemedShell() {
  const { content } = useSiteContent();
  return (
    <>
      <ThemeController theme={content?.settings.theme} />
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>
      <AppHeader />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SitePage />} />
            <Route path="/entrar" element={<LoginPage />} />
            {appRoutes}
            <Route path="*" element={<EmptyState icon="🧭" title="Esta página no existe" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
