import { useState } from "react";
import { config } from "@/core/config";
import { formatRelative } from "@/domain/dates";
import {
  buildInviteUrl, INVITABLE_ROLES, INVITE_EXPIRY_OPTIONS, invitationStatus, type InvitationStatus,
} from "@/domain/invitations";
import { ROLE_LABELS } from "@/domain/permissions";
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

const STATUS_BADGE: Record<InvitationStatus, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "badge--warning" },
  used: { label: "Usada", tone: "badge--success" },
  expired: { label: "Vencida", tone: "badge--muted" },
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

  const create = async () => {
    const created = await run(() => backend.invitations.create({ role, note, expiresInHours: hours }), "Enlace listo 💌");
    if (!created) return;
    setUrl(buildInviteUrl(siteOrigin(), created.token));
    onCreated();
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

  const share = async () => {
    if (!url) return;
    await navigator.share({ title: "Tu invitación 💖", text: "Crea tu cuenta con este enlace:", url }).catch(() => undefined);
  };

  const expiryLabel = INVITE_EXPIRY_OPTIONS.find((o) => o.hours === hours)?.label ?? "";

  return (
    <Modal title={url ? "Comparte la invitación" : "Invitar con enlace o QR"} onClose={onClose}
      footer={url
        ? <button className="btn" onClick={onClose}>Listo</button>
        : <><button className="btn btn--ghost" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy} onClick={create}>Crear enlace</button></>}>
      {url ? (
        <div className={styles.result}>
          <p className="muted" style={{ margin: 0 }}>
            Que lo escanee con la cámara del celular o ábrele el enlace. Elegirá su nombre, correo y contraseña,
            y entrará como <strong>{ROLE_LABELS[role]}</strong>. Sirve <strong>una sola vez</strong> y vence en {expiryLabel}.
          </p>
          <InviteQr url={url} fileName="invitacion.png" />
          <Field label="Enlace" hint="Este enlace no se vuelve a mostrar: compártelo ahora.">
            {(id) => <input id={id} className={`input ${styles.link}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />}
          </Field>
          <div className={styles.actions}>
            <button className="btn btn--sm" onClick={copy}>Copiar enlace</button>
            {typeof navigator.share === "function" && <button className="btn btn--sm btn--soft" onClick={share}>Compartir…</button>}
          </div>
        </div>
      ) : (
        <div className="stack">
          <Field label="¿Para quién es?" hint="Sólo para que tú la reconozcas en la lista">
            {(id) => <input id={id} className="input" maxLength={80} placeholder="Para Camila" value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Field label="Entrará como">
            {(id) => (
              <select id={id} className="select" value={role} onChange={(e) => setRole(e.target.value as InvitableRole)}>
                {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            )}
          </Field>
          <Field label="El enlace vence en">
            {(id) => (
              <select id={id} className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {INVITE_EXPIRY_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
              </select>
            )}
          </Field>
          <p className="muted" style={{ margin: 0 }}>Por seguridad, un enlace nunca puede crear otro super administrador.</p>
        </div>
      )}
    </Modal>
  );
}

function InvitationRow({ invitation, onRevoke }: { invitation: Invitation; onRevoke(): void }) {
  const status = invitationStatus(invitation);
  const badge = STATUS_BADGE[status];
  return (
    <li className={styles.item}>
      <div className={styles.itemText}>
        <strong>{invitation.note || "Invitación"}</strong>
        <span className="muted">
          {ROLE_LABELS[invitation.role]} · {status === "used" && invitation.usedAt
            ? `usada ${formatRelative(invitation.usedAt)}`
            : `${status === "expired" ? "venció" : "vence"} ${formatRelative(invitation.expiresAt)}`}
        </span>
      </div>
      <div className="row">
        <span className={`badge ${badge.tone}`}>{badge.label}</span>
        {status !== "used" && (
          <button className="btn btn--sm btn--ghost" aria-label={`Revocar ${invitation.note || "invitación"}`} onClick={onRevoke}>
            {status === "pending" ? "Revocar" : "Quitar"}
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

  const revoke = async (invitation: Invitation) => {
    const pending = invitationStatus(invitation) === "pending";
    if (pending && !(await confirm({
      title: "¿Revocar esta invitación?", body: "El enlace y el QR dejarán de funcionar.", confirmLabel: "Revocar", danger: true,
    }))) return;
    await run(() => backend.invitations.revoke(invitation.id), pending ? "Invitación revocada" : undefined);
    await reload();
  };

  return (
    <section className="card stack" aria-labelledby="invitaciones-titulo">
      <div className="row-between">
        <div>
          <h2 id="invitaciones-titulo" style={{ margin: 0, fontSize: "1.1rem" }}>Invitar con enlace o QR</h2>
          <p className="muted" style={{ margin: 0 }}>La persona crea su cuenta sola: no necesitas saber su correo.</p>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>Crear enlace</button>
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
