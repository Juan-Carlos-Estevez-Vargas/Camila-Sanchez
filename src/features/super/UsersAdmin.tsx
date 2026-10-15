import { useState } from "react";
import { formatRelative } from "@/domain/dates";
import { ROLE_LABELS } from "@/domain/permissions";
import { ROLES, type Profile, type Role } from "@/domain/types";
import type { NewUserInput } from "@/data/ports";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NewUserModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const backend = useBackend();
  const { run, busy } = useSaver();
  const [form, setForm] = useState<NewUserInput>({ email: "", displayName: "", role: "editor", password: "" });
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const valid = EMAIL.test(form.email) && form.displayName.trim() && (mode === "invite" || (form.password?.length ?? 0) >= 8);

  const submit = async () => {
    const input = { ...form, password: mode === "password" ? form.password : undefined };
    const ok = await run(() => backend.users.createUser(input).then(() => true),
      mode === "invite" ? "Invitación enviada 💌" : "Usuario creado");
    if (ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <Modal title="Nuevo usuario" onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={onClose}>Cancelar</button><button className="btn" disabled={!valid || busy} onClick={submit}>{mode === "invite" ? "Enviar invitación" : "Crear"}</button></>}>
      <div className="stack">
        <div className="tabs" role="tablist">
          <button role="tab" className="tab" aria-selected={mode === "invite"} onClick={() => setMode("invite")}>Invitar por correo</button>
          <button role="tab" className="tab" aria-selected={mode === "password"} onClick={() => setMode("password")}>Con contraseña</button>
        </div>
        <Field label="Nombre">{(id) => <input id={id} className="input" maxLength={80} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}</Field>
        <Field label="Correo">{(id) => <input id={id} className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        {mode === "password" && (
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. Pídele que la cambie al entrar.">
            {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          </Field>
        )}
        <Field label="Rol">
          {(id) => (
            <select id={id} className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
  const { data: users, loading, reload } = useAsync(() => backend.users.listProfiles(), [backend]);

  const update = async (profile: Profile, patch: Partial<Profile>, message: string) => {
    await run(() => backend.users.updateProfile(profile.id, patch), message);
    await reload();
    if (profile.id === me?.id) await refreshMe();
  };

  return (
    <AdminPage title="Usuarios" description="Quién puede entrar y qué rol tiene cada persona."
      actions={<button className="btn" onClick={() => setCreating(true)}>+ Nuevo usuario</button>}>
      {loading && !users ? <PageLoader /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Desde</th><th /></tr></thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button className="btn btn--sm btn--ghost" onClick={() => setRenaming(u)} title="Cambiar nombre">{u.displayName || "(sin nombre)"} ✎</button>
                    {u.id === me?.id && <span className="badge" style={{ marginLeft: 6 }}>tú</span>}
                  </td>
                  <td>
                    <select className="select" style={{ minWidth: 170 }} value={u.role} aria-label={`Rol de ${u.displayName}`}
                      onChange={(e) => void update(u, { role: e.target.value as Role }, "Rol actualizado")}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" role="switch" checked={u.isActive} disabled={u.id === me?.id}
                        onChange={(e) => void update(u, { isActive: e.target.checked }, e.target.checked ? "Cuenta activada" : "Cuenta desactivada")} />
                      <span>{u.isActive ? "Activa" : "Desactivada"}</span>
                    </label>
                  </td>
                  <td className="muted">{u.createdAt ? formatRelative(u.createdAt) : "—"}</td>
                  <td>
                    {u.id !== me?.id && (
                      <button className="btn btn--sm btn--ghost" aria-label={`Eliminar ${u.displayName}`} onClick={async () => {
                        if (await confirm({ title: `¿Eliminar a ${u.displayName}?`, body: "Se borrará su cuenta y sus mensajes. No se puede deshacer.", confirmLabel: "Eliminar", danger: true })) {
                          await run(() => backend.users.deleteUser(u.id), "Usuario eliminado");
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
      {creating && <NewUserModal onClose={() => setCreating(false)} onCreated={() => void reload()} />}
      {renaming && (
        <RenameModal profile={renaming} onClose={() => setRenaming(null)} onSave={async (name) => {
          await update(renaming, { displayName: name }, "Nombre actualizado");
          setRenaming(null);
        }} />
      )}
      {confirmElement}
    </AdminPage>
  );
}

function RenameModal({ profile, onClose, onSave }: { profile: Profile; onClose(): void; onSave(name: string): void }) {
  const [name, setName] = useState(profile.displayName);
  return (
    <Modal title="Cambiar nombre" onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={onClose}>Cancelar</button><button className="btn" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Guardar</button></>}>
      <Field label="Nombre visible">{(id) => <input id={id} className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
    </Modal>
  );
}
