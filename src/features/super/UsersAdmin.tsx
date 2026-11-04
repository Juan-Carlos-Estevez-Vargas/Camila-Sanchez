import { useState } from "react";
import { formatRelative } from "@/domain/dates";
import { MIN_PASSWORD_LENGTH } from "@/domain/invitations";
import { passwordProblem } from "@/domain/password";
import { roleLabel } from "@/domain/permissions";
import { ROLES, type Profile, type Role } from "@/domain/types";
import type { NewUserInput } from "@/data/ports";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { InvitationsCard } from "./invitations/InvitationsCard";
import { RecoveryLinkModal } from "./RecoveryLinkModal";
import { useT } from "@/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NewUserModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const backend = useBackend();
  const { run, busy } = useSaver();
  const [form, setForm] = useState<NewUserInput>({ email: "", displayName: "", role: "editor", password: "" });
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const i18n = useT();
  const t = i18n.superAdmin.users;
  const passwordError = mode === "password" && (form.password?.length ?? 0) >= MIN_PASSWORD_LENGTH
    ? passwordProblem(form.password ?? "", [form.email, form.displayName]) : null;
  const valid = EMAIL.test(form.email) && form.displayName.trim()
    && (mode === "invite" || ((form.password?.length ?? 0) >= MIN_PASSWORD_LENGTH && !passwordError));

  const submit = async () => {
    const input = { ...form, password: mode === "password" ? form.password : undefined };
    const ok = await run(() => backend.users.createUser(input).then(() => true),
      mode === "invite" ? t.invited : t.created);
    if (ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <Modal title={t.newTitle} onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={onClose}>{i18n.common.cancel}</button><button className="btn" disabled={!valid || busy} onClick={submit}>{mode === "invite" ? t.sendInvite : t.create}</button></>}>
      <div className="stack">
        <div className="tabs" role="radiogroup" aria-label={t.how} onKeyDown={onRovingKeyDown}>
          <button type="button" role="radio" className="tab" aria-checked={mode === "invite"} tabIndex={rovingTabIndex(mode === "invite")} onClick={() => setMode("invite")}>{t.byEmail}</button>
          <button type="button" role="radio" className="tab" aria-checked={mode === "password"} tabIndex={rovingTabIndex(mode === "password")} onClick={() => setMode("password")}>{t.withPassword}</button>
        </div>
        <Field label={t.name}>{(id) => <input id={id} className="input" maxLength={80} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}</Field>
        <Field label={t.email}>{(id) => <input id={id} className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        {mode === "password" && (
          <Field label={t.initialPassword} hint={t.initialPasswordHint(MIN_PASSWORD_LENGTH)} error={passwordError}>
            {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          </Field>
        )}
        <Field label={t.role}>
          {(id) => (
            <select id={id} className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

export default function UsersAdmin() {
  const backend = useBackend();
  const { user: me, refresh: refreshMe } = useAuth();
  const { run } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState<Profile | null>(null);
  const { data: users, loading, reload } = useAsync(() => backend.users.listProfiles(), [backend]);
  const t = useT().superAdmin.users;

  const update = async (profile: Profile, patch: Partial<Profile>, message: string) => {
    await run(() => backend.users.updateProfile(profile.id, patch), message);
    await reload();
    if (profile.id === me?.id) await refreshMe();
  };

  return (
    <AdminPage title={t.title} description={t.description}
      actions={<button className="btn" onClick={() => setCreating(true)}>{t.add}</button>}>
      {loading && !users ? <PageLoader /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t.name}</th><th>{t.role}</th><th>{t.status}</th><th>{t.since}</th><th><span className="visually-hidden">{t.actions}</span></th></tr></thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button className="btn btn--sm btn--ghost" onClick={() => setRenaming(u)} title={t.rename}>{u.displayName || t.noName} ✎</button>
                    {u.id === me?.id && <span className="badge" style={{ marginLeft: 6 }}>{t.you}</span>}
                  </td>
                  <td>
                    <select className="select" style={{ minWidth: 170 }} value={u.role} aria-label={t.roleOf(u.displayName)}
                      onChange={(e) => void update(u, { role: e.target.value as Role }, t.roleUpdated)}>
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" role="switch" checked={u.isActive} disabled={u.id === me?.id}
                        onChange={(e) => void update(u, { isActive: e.target.checked }, e.target.checked ? t.activated : t.deactivated)} />
                      <span>{u.isActive ? t.active : t.inactive}</span>
                    </label>
                  </td>
                  <td className="muted">{u.createdAt ? formatRelative(u.createdAt) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {u.id !== me?.id && u.isActive && (
                      <button className="btn btn--sm btn--ghost" aria-label={t.recoveryFor(u.displayName)}
                        title={t.recoveryTitle} onClick={() => setRecovering(u)}>🔑</button>
                    )}
                    {u.id !== me?.id && (
                      <button className="btn btn--sm btn--ghost" aria-label={t.deleteNamed(u.displayName)} onClick={async () => {
                        if (await confirm({ title: t.deleteTitle(u.displayName), body: t.deleteBody, confirmLabel: t.delete, danger: true })) {
                          await run(() => backend.users.deleteUser(u.id), t.deleted);
                          await reload();
                        }
                      }}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InvitationsCard onChange={() => void reload()} />
      {recovering && <RecoveryLinkModal profile={recovering} onClose={() => setRecovering(null)} />}
      {creating && <NewUserModal onClose={() => setCreating(false)} onCreated={() => void reload()} />}
      {renaming && (
        <RenameModal profile={renaming} onClose={() => setRenaming(null)} onSave={async (name) => {
          await update(renaming, { displayName: name }, t.renamed);
          setRenaming(null);
        }} />
      )}
      {confirmElement}
    </AdminPage>
  );
}

function RenameModal({ profile, onClose, onSave }: { profile: Profile; onClose(): void; onSave(name: string): void }) {
  const [name, setName] = useState(profile.displayName);
  const i18n = useT();
  const t = i18n.superAdmin.users;
  return (
    <Modal title={t.rename} onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={onClose}>{i18n.common.cancel}</button><button className="btn" disabled={!name.trim()} onClick={() => onSave(name.trim())}>{i18n.admin.save}</button></>}>
      <Field label={t.visibleName}>{(id) => <input id={id} className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
    </Modal>
  );
}
