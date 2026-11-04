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
import { useT } from "@/i18n";

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
  const i18n = useT();
  const t = i18n.lists.settings;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName || i18n.common.someone;
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
    void act(() => backend.lists.update(list.id, { ...form, dueOn: form.dueOn || null }), t.saved).then((ok) => ok && onClose());
  };

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    if (!newMember) return;
    void act(() => backend.lists.addMember(list.id, newMember), t.added(nameOf(newMember))).then((ok) => ok && setNewMember(""));
  };

  const removeMember = async (id: string) => {
    if (!(await confirm({ title: t.removeTitle(nameOf(id)), body: t.removeBody, confirmLabel: t.remove, danger: true }))) return;
    void act(() => backend.lists.removeMember(list.id, id));
  };

  const leave = async () => {
    if (!(await confirm({ title: t.leaveTitle, body: t.leaveBody, confirmLabel: t.leave, danger: true }))) return;
    try {
      await backend.lists.removeMember(list.id, user!.id);
      navigate("/listas");
    } catch (error) {
      toast.error(error);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: t.deleteTitle(list.title), body: t.deleteBody, confirmLabel: t.delete, danger: true }))) return;
    try {
      await backend.lists.remove(list.id);
      toast.success(t.deleted);
      navigate("/listas");
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal title={t.title} onClose={onClose}
      footer={isOwner
        ? <button className="btn btn--ghost btn--sm list-settings__danger" onClick={() => void remove()}>{t.deleteButton}</button>
        : <button className="btn btn--ghost btn--sm list-settings__danger" onClick={() => void leave()}>{t.leaveButton}</button>}
    >
      <div className="stack">
        <section className="stack" aria-labelledby="list-members-title">
          <h4 id="list-members-title" style={{ margin: 0 }}>{t.members}</h4>
          <ul className="mini-list">
            {list.memberIds.map((id) => (
              <li key={id}>
                <Avatar person={profiles.find((p) => p.id === id)} size={28} />
                <span className="grow">{id === user?.id ? t.you(nameOf(id)) : nameOf(id)}</span>
                {id === list.ownerId && <span className="badge badge--muted">{t.owner}</span>}
                {isOwner && id !== list.ownerId && (
                  <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void removeMember(id)}>{t.remove}</button>
                )}
              </li>
            ))}
          </ul>
          {candidates.length > 0 && (
            <form className="mini-form" onSubmit={addMember}>
              <select className="select grow" aria-label={t.personToAdd} value={newMember} onChange={(e) => setNewMember(e.target.value)}>
                <option value="">{t.addSomeone}</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.displayName || i18n.lists.noName}</option>)}
              </select>
              <button className="btn btn--soft btn--sm" disabled={busy || !newMember}>{t.addButton}</button>
            </form>
          )}
        </section>
        <form className="stack" onSubmit={save}>
          <ListFields value={form} onChange={setForm} />
          <button className="btn" disabled={busy || !form.title.trim()}>{t.save}</button>
        </form>
      </div>
      {confirmElement}
    </Modal>
  );
}
