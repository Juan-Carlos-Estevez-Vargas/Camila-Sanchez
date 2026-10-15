import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { createBackend } from "@/data/backend";
import { BackendProvider } from "@/state/BackendContext";
import "@/styles/main.scss";

async function bootstrap() {
  const backend = await createBackend();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BackendProvider backend={backend}>
        <App />
      </BackendProvider>
    </StrictMode>,
  );
}

void bootstrap();

// El service worker sólo en producción (en desarrollo estorba al hot reload).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("[sw]", error));
  });
}
