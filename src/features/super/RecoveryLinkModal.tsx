import { useState } from "react";
import { config } from "@/core/config";
import type { Profile } from "@/domain/types";
import { buildRecoveryUrl, RECOVERY_LINK_HOURS } from "@/domain/recovery";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { InviteQr } from "./invitations/InviteQr";
import styles from "./invitations/Invitations.module.scss";

/**
 * Enlace para que alguien cree una contraseña nueva cuando la olvidó, sin
 * depender de que le llegue el correo: se muestra como QR o enlace para
 * compartirlo en persona.
 */
export function RecoveryLinkModal({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const { run, busy } = useSaver();
  const [url, setUrl] = useState<string | null>(null);

  const create = async () => {
    const tokenHash = await run(() => backend.users.createRecoveryLink(profile.id), "Enlace listo 🔑");
    if (tokenHash) setUrl(buildRecoveryUrl(config.siteUrl || window.location.origin, tokenHash));
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.show({ title: "No pude copiarlo", body: "Selecciona el enlace y cópialo a mano.", tone: "error" });
    }
  };

  const hours = `${RECOVERY_LINK_HOURS} ${RECOVERY_LINK_HOURS === 1 ? "hora" : "horas"}`;

  return (
    <Modal title={`Nueva contraseña para ${profile.displayName}`} onClose={onClose}
      footer={url
        ? <button className="btn" onClick={onClose}>Listo</button>
        : <><button className="btn btn--ghost" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy} onClick={create}>Crear enlace</button></>}>
      {url ? (
        <div className={styles.result}>
          <p className="muted" style={{ margin: 0 }}>
            Que lo escanee o abra el enlace: entrará directo a crear su contraseña nueva.
            Sirve <strong>una sola vez</strong> y vence en {hours}.
          </p>
          <InviteQr url={url} fileName="recuperar-contrasena.png" alt="Código QR para crear una contraseña nueva" />
          <Field label="Enlace" hint="Compártelo sólo con esa persona: abre su cuenta.">
            {(id) => <input id={id} className={`input ${styles.link}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />}
          </Field>
          <div className={styles.actions}>
            <button className="btn btn--sm" onClick={copy}>Copiar enlace</button>
          </div>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Úsalo si {profile.displayName} olvidó su contraseña y el correo de recuperación no le llega.
          Se crea un enlace de un solo uso que vence en {hours}; su contraseña actual sigue igual hasta que elija otra.
        </p>
      )}
    </Modal>
  );
}
