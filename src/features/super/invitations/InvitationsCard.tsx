import { useState } from "react";
import { config } from "@/core/config";
import { formatRelative } from "@/domain/dates";
import {
  buildInviteUrl, INVITABLE_ROLES, INVITE_EXPIRY_OPTIONS, invitationStatus, type InvitationStatus,
} from "@/domain/invitations";
import { roleLabel } from "@/domain/permissions";
import type { InvitableRole, Invitation } from "@/domain/types";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { InviteQr } from "./InviteQr";
import styles from "./Invitations.module.scss";
import { useT } from "@/i18n";

const STATUS_TONE: Record<InvitationStatus, string> = {
  pending: "badge--warning",
  used: "badge--success",
  expired: "badge--muted",
};
const siteOrigin = () => config.siteUrl || window.location.origin;

function NewInvitationModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const { run, busy } = useSaver();
  const [note, setNote] = useState("");
  const [role, setRole] = useState<InvitableRole>("editor");
  const [hours, setHours] = useState<number>(INVITE_EXPIRY_OPTIONS[0].hours);
  const [url, setUrl] = useState<string | null>(null);
  const i18n = useT();
  const l = i18n.superAdmin.links;
  const t = i18n.superAdmin.invitations;

  const create = async () => {
    const created = await run(() => backend.invitations.create({ role, note, expiresInHours: hours }), l.inviteReady);
    if (!created) return;
    setUrl(buildInviteUrl(siteOrigin(), created.token));
    onCreated();
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

  const share = async () => {
    if (!url) return;
    await navigator.share({ title: t.shareTitle, text: t.shareText, url }).catch(() => undefined);
  };

  const expiryLabel = l.expiry(hours);

  return (
    <Modal title={url ? t.titleShare : t.title} onClose={onClose}
      footer={url
        ? <button className="btn" onClick={onClose}>{l.done}</button>
        : <><button className="btn btn--ghost" onClick={onClose}>{i18n.common.cancel}</button><button className="btn" disabled={busy} onClick={create}>{l.create}</button></>}>
      {url ? (
        <div className={styles.result}>
          <p className="muted" style={{ margin: 0 }}>
            {t.readyBefore} <strong>{roleLabel(role)}</strong>{t.readyMiddle} <strong>{t.once}</strong> {t.readyAfter(expiryLabel)}
          </p>
          <InviteQr url={url} fileName={t.fileName} alt={l.inviteQrAlt} />
          <Field label={l.link} hint={t.linkHint}>
            {(id) => <input id={id} className={`input ${styles.link}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />}
          </Field>
          <div className={styles.actions}>
            <button className="btn btn--sm" onClick={copy}>{l.copy}</button>
            {typeof navigator.share === "function" && <button className="btn btn--sm btn--soft" onClick={share}>{l.share}</button>}
          </div>
        </div>
      ) : (
        <div className="stack">
          <Field label={t.forWhom} hint={t.forWhomHint}>
            {(id) => <input id={id} className="input" maxLength={80} placeholder={t.forWhomPlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Field label={t.joinAs}>
            {(id) => (
              <select id={id} className="select" value={role} onChange={(e) => setRole(e.target.value as InvitableRole)}>
                {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t.expiresIn}>
            {(id) => (
              <select id={id} className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {INVITE_EXPIRY_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{l.expiry(o.hours)}</option>)}
              </select>
            )}
          </Field>
          <p className="muted" style={{ margin: 0 }}>{t.noSuper}</p>
        </div>
      )}
    </Modal>
  );
}

function InvitationRow({ invitation, onRevoke }: { invitation: Invitation; onRevoke(): void }) {
  const status = invitationStatus(invitation);
  const t = useT().superAdmin.invitations;
  return (
    <li className={styles.item}>
      <div className={styles.itemText}>
        <strong>{invitation.note || t.fallback}</strong>
        <span className="muted">
          {roleLabel(invitation.role)} · {status === "used" && invitation.usedAt
            ? t.usedAgo(formatRelative(invitation.usedAt))
            : (status === "expired" ? t.expiredAgo : t.expires)(formatRelative(invitation.expiresAt))}
        </span>
      </div>
      <div className="row">
        <span className={`badge ${STATUS_TONE[status]}`}>{t.status[status]}</span>
        {status !== "used" && (
          <button className="btn btn--sm btn--ghost" aria-label={t.revokeNamed(invitation.note || t.fallback)} onClick={onRevoke}>
            {status === "pending" ? t.revoke : t.remove}
          </button>
        )}
      </div>
    </li>
  );
}

/** Invitaciones de un solo uso: la persona crea su cuenta sin dar antes su correo. */
export function InvitationsCard({ onChange }: { onChange(): void }) {
  const backend = useBackend();
  const { run } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [creating, setCreating] = useState(false);
  const { data: invitations, reload } = useAsync(() => backend.invitations.list(), [backend]);
  const i18n = useT();
  const t = i18n.superAdmin.invitations;

  const revoke = async (invitation: Invitation) => {
    const pending = invitationStatus(invitation) === "pending";
    if (pending && !(await confirm({
      title: t.revokeTitle, body: t.revokeBody, confirmLabel: t.revoke, danger: true,
    }))) return;
    await run(() => backend.invitations.revoke(invitation.id), pending ? t.revoked : undefined);
    await reload();
  };

  return (
    <section className="card stack" aria-labelledby="invitaciones-titulo">
      <div className="row-between">
        <div>
          <h2 id="invitaciones-titulo" style={{ margin: 0, fontSize: "1.1rem" }}>{t.title}</h2>
          <p className="muted" style={{ margin: 0 }}>{t.cardHint}</p>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>{i18n.superAdmin.links.create}</button>
      </div>
      {invitations && invitations.length > 0 && (
        <ul className={styles.list}>
          {invitations.map((i) => <InvitationRow key={i.id} invitation={i} onRevoke={() => void revoke(i)} />)}
        </ul>
      )}
      {creating && (
        <NewInvitationModal onClose={() => { setCreating(false); void reload(); onChange(); }} onCreated={() => void reload()} />
      )}
      {confirmElement}
    </section>
  );
}
