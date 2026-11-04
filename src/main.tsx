import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { createBackend } from "@/data/backend";
import { pruneOldCaches } from "@/data/localCache";
import { initI18n } from "@/i18n";
import { listenForInstallPrompt } from "@/services/pwa/install";
import { registerServiceWorker } from "@/services/pwa/serviceWorker";
import { BackendProvider } from "@/state/BackendContext";
import "@/styles/main.scss";

async function bootstrap() {
  // La página principal se descarga a la vez que el backend, no después.
  if (window.location.pathname === "/") void import("@/features/site/SitePage");
  // El idioma (el guardado o el del navegador/PC) se prepara junto con el backend.
  const [backend] = await Promise.all([createBackend(), initI18n()]);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BackendProvider backend={backend}>
        <App />
      </BackendProvider>
    </StrictMode>,
  );
}

// El aviso "se puede instalar" llega muy pronto: se escucha antes de pintar.
listenForInstallPrompt();
void bootstrap();
pruneOldCaches();

// El service worker sólo en producción (en desarrollo estorba al hot reload).
if (import.meta.env.PROD) registerServiceWorker();
