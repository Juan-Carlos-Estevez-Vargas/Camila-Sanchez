import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { DEFAULT_THEME } from "@/domain/defaults";
import { personalTheme } from "@/domain/palettes";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { NotificationsProvider } from "@/state/NotificationsContext";
import { PresenceHeartbeat } from "@/state/PresenceHeartbeat";
import { SeoController } from "@/state/SeoController";
import { SiteContentProvider, useSiteContent } from "@/state/SiteContentStore";
import { SpecialDayProvider, useSpecialDay } from "@/state/SpecialDayContext";
import { specialTheme } from "@/domain/specialDays";
import { ThemeController } from "@/state/ThemeController";
import { ToastProvider } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { SpecialDayRibbon } from "./SpecialDayRibbon";
import { SpecialDayGarland, SpecialDayScene } from "./SpecialDayScene";
import { ConsentGate } from "@/features/legal/ConsentGate";
import { CookieBanner } from "@/features/legal/CookieBanner";
import { AppStatus } from "@/features/install/AppStatus";
import { InstallBanner } from "@/features/install/InstallBanner";
import { PlayerProvider } from "@/features/player/PlayerContext";
import { WhatsNew } from "@/features/whatsNew/WhatsNew";
import { INSTALL_PATH } from "@/core/seo";
import { ErrorBoundary } from "./ErrorBoundary";
import { RouteAnnouncer, SkipLink } from "./RouteAnnouncer";
import { appRoutes } from "./routes";
import { useT } from "@/i18n";

const SitePage = lazy(() => import("@/features/site/SitePage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const InvitePage = lazy(() => import("@/features/auth/InvitePage"));
const RecoverPage = lazy(() => import("@/features/auth/RecoverPage"));
const LegalPage = lazy(() => import("@/features/legal/LegalPage"));
const InstallPage = lazy(() => import("@/features/install/InstallPage"));
const TwoStepGate = lazy(() => import("@/features/auth/TwoStepGate"));

function NotFound() {
  const t = useT().app;
  return (
    <main id="contenido-principal" className="container">
      <EmptyState icon="🧭" title={t.notFound} heading>
        <Link className="btn" to="/">{t.backHome}</Link>
      </EmptyState>
    </main>
  );
}

/** El chat es una app a pantalla completa: sin pie de página. */
function Footer() {
  const { pathname } = useLocation();
  return pathname === "/chat" || pathname.startsWith("/chat/") ? null : <AppFooter />;
}

function ThemedShell() {
  const { content } = useSiteContent();
  const { profile, twoStepPending } = useAuth();
  const { day } = useSpecialDay();
  // Quien entra sin cuenta ve los colores de la página; cada persona, los suyos.
  // En una fecha especial (cumpleaños, Halloween, Navidad...) manda el tema de
  // ese día para todos, encima de los colores de cada uno.
  const siteTheme = content?.settings.theme ?? DEFAULT_THEME;
  const theme = useMemo(
    () => (day ? specialTheme(siteTheme, day) : personalTheme(siteTheme, profile?.themeColors)),
    [siteTheme, profile?.themeColors, day],
  );
  return (
    <>
      <ThemeController theme={theme} />
      <SeoController />
      <PresenceHeartbeat />
      <SkipLink />
      <RouteAnnouncer />
      <AppHeader />
      <SpecialDayGarland />
      <SpecialDayRibbon />
      <SpecialDayScene />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {/* Falta el código de la verificación en dos pasos: nada más hasta escribirlo. */}
          {twoStepPending ? <TwoStepGate /> : <Routes>
            <Route path="/" element={<SitePage />} />
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/invitacion" element={<InvitePage />} />
            <Route path="/recuperar" element={<RecoverPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/legal/:doc" element={<LegalPage />} />
            <Route path={INSTALL_PATH} element={<InstallPage />} />
            {appRoutes}
            <Route path="*" element={<NotFound />} />
          </Routes>}
        </Suspense>
      </ErrorBoundary>
      <Footer />
      <ConsentGate>
        <WhatsNew />
      </ConsentGate>
      <CookieBanner />
      <InstallBanner />
      <AppStatus />
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
              {/* Arriba de las rutas: la playlist sigue sonando al cambiar de página. */}
              <PlayerProvider>
                {/* La fecha especial de hoy cambia el tema de toda la app. */}
                <SpecialDayProvider>
                  <ThemedShell />
                </SpecialDayProvider>
              </PlayerProvider>
            </NotificationsProvider>
          </SiteContentProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
