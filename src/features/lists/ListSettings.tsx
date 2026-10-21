/** Ajustes de una lista: datos, quiénes la comparten y borrarla o salirse. */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { canUseLists } from "@/domain/lists";
import type { Profile, RolePermission, TodoListDetail } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar } from "@/ui/Avatar";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";
import { ListFields, type ListFormValue } from "./listParts";

interface Props {
  detail: TodoListDetail;
  profiles: Profile[];
  rolePermissions: RolePermission[];
  onChanged(): Promise<void>;
  onClose(): void;
}

export function ListSettings({ detail, profiles, rolePermissions, onChanged, onClose }: Props) {
  const backend = useBackend();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmElement] = useConfirm();
  const { list } = detail;
  const [form, setForm] = useState<ListFormValue>({ title: list.title, description: list.description, emoji: list.emoji, dueOn: list.dueOn ?? "" });
  const [newMember, setNewMember] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = list.ownerId === user?.id;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName || "Alguien";
  const candidates = profiles.filter((p) => !list.memberIds.includes(p.id) && canUseLists(p, rolePermissions));

  /** Devuelve si salió bien. */
  const act = async (action: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      await onChanged();
      return true;
    } catch (error) {
      toast.error(error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    void act(() => backend.lists.update(list.id, { ...form, dueOn: form.dueOn || null }), "Lista guardada").then((ok) => ok && onClose());
  };

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    if (!newMember) return;
    void act(() => backend.lists.addMember(list.id, newMember), `Sumaste a ${nameOf(newMember)} 💖`).then((ok) => ok && setNewMember(""));
  };

  const removeMember = async (id: string) => {
    if (!(await confirm({ title: `¿Sacar a ${nameOf(id)} de la lista?`, body: "Dejará de verla. Puedes volver a sumarla cuando quieras.", confirmLabel: "Sacar", danger: true }))) return;
    void act(() => backend.lists.removeMember(list.id, id));
  };

  const leave = async () => {
    if (!(await confirm({ title: "¿Salirte de esta lista?", body: "Dejarás de verla. Alguien de la lista puede volver a sumarte.", confirmLabel: "Salirme", danger: true }))) return;
    try {
      await backend.lists.removeMember(list.id, user!.id);
      navigate("/listas");
    } catch (error) {
      toast.error(error);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `¿Borrar «${list.title}»?`, body: "Se borra para todos, con sus tareas, materiales y fotos. No se puede deshacer.", confirmLabel: "Borrar lista", danger: true }))) return;
    try {
      await backend.lists.remove(list.id);
      toast.success("Lista borrada");
      navigate("/listas");
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal title="Ajustes de la lista" onClose={onClose}
      footer={isOwner
        ? <button className="btn btn--ghost btn--sm list-settings__danger" onClick={() => void remove()}>🗑 Borrar lista</button>
        : <button className="btn btn--ghost btn--sm list-settings__danger" onClick={() => void leave()}>🚪 Salirme de la lista</button>}
    >
      <div className="stack">
        <section className="stack" aria-labelledby="list-members-title">
          <h4 id="list-members-title" style={{ margin: 0 }}>👥 Con quién</h4>
          <ul className="mini-list">
            {list.memberIds.map((id) => (
              <li key={id}>
                <Avatar person={profiles.find((p) => p.id === id)} size={28} />
                <span className="grow">{id === user?.id ? `${nameOf(id)} (tú)` : nameOf(id)}</span>
                {id === list.ownerId && <span className="badge badge--muted">Creó la lista</span>}
                {isOwner && id !== list.ownerId && (
                  <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void removeMember(id)}>Sacar</button>
                )}
              </li>
            ))}
          </ul>
          {candidates.length > 0 && (
            <form className="mini-form" onSubmit={addMember}>
              <select className="select grow" aria-label="Persona para sumar" value={newMember} onChange={(e) => setNewMember(e.target.value)}>
                <option value="">Sumar a alguien…</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.displayName || "Sin nombre"}</option>)}
              </select>
              <button className="btn btn--soft btn--sm" disabled={busy || !newMember}>Sumar</button>
            </form>
          )}
        </section>
        <form className="stack" onSubmit={save}>
          <ListFields value={form} onChange={setForm} />
          <button className="btn" disabled={busy || !form.title.trim()}>Guardar cambios</button>
        </form>
      </div>
      {confirmElement}
    </Modal>
  );
}
