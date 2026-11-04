import { useState } from "react";
import { promptInstall } from "@/services/pwa/install";
import { useToast } from "@/state/ToastContext";
import { useT } from "@/i18n";

/** Abre el diálogo de instalación del sistema (Android, Chrome y Edge). */
export function InstallButton({ className = "btn", label }: { className?: string; label?: string }) {
  const t = useT().install;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (await promptInstall()) toast.success(t.accepted);
        } catch (error) {
          toast.error(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t.installing : label ?? t.installButton}
    </button>
  );
}
