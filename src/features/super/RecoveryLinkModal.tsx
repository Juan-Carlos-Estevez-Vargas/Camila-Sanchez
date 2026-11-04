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
import { useT } from "@/i18n";

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
  const i18n = useT();
  const l = i18n.superAdmin.links;
  const t = i18n.superAdmin.recovery;

  const create = async () => {
    const tokenHash = await run(() => backend.users.createRecoveryLink(profile.id), l.ready);
    if (tokenHash) setUrl(buildRecoveryUrl(config.siteUrl || window.location.origin, tokenHash));
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(l.copied);
    } catch {
      toast.show({ title: l.cantCopy, body: l.cantCopyBody, tone: "error" });
    }
  };

  const hours = l.hours(RECOVERY_LINK_HOURS);

  return (
    <Modal title={t.title(profile.displayName)} onClose={onClose}
      footer={url
        ? <button className="btn" onClick={onClose}>{l.done}</button>
        : <><button className="btn btn--ghost" onClick={onClose}>{i18n.common.cancel}</button><button className="btn" disabled={busy} onClick={create}>{l.create}</button></>}>
      {url ? (
        <div className={styles.result}>
          <p className="muted" style={{ margin: 0 }}>
            {t.readyBefore} <strong>{t.once}</strong> {t.readyAfter(hours)}
          </p>
          <InviteQr url={url} fileName={t.fileName} alt={t.qrAlt} />
          <Field label={l.link} hint={t.linkHint}>
            {(id) => <input id={id} className={`input ${styles.link}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />}
          </Field>
          <div className={styles.actions}>
            <button className="btn btn--sm" onClick={copy}>{l.copy}</button>
          </div>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t.explain(profile.displayName, hours)}
        </p>
      )}
    </Modal>
  );
}
