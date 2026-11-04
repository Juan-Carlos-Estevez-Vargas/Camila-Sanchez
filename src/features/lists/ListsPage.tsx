import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { canUseLists, joinNames } from "@/domain/lists";
import type { Profile, TodoListSummary } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar, AvatarStack } from "@/ui/Avatar";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { burst } from "@/features/site/effects/FloatingEffects";
import { DueBadge, EMPTY_LIST_FORM, ListFields, ProgressBar, type ListFormValue } from "./listParts";
import "./styles/lists.scss";
import { useT } from "@/i18n";

/** Casillas para elegir con quién se comparte. */
export function PeoplePicker({ people, selected, onChange }: { people: Profile[]; selected: string[]; onChange(ids: string[]): void }) {
  const t = useT().lists;
  if (people.length === 0) return <p className="muted">{t.index.nobody}</p>;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="people-picker">
      {people.map((p) => (
        <label key={p.id} className={`people-picker__option${selected.includes(p.id) ? " is-active" : ""}`}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
          <Avatar person={p} size={28} />
          {p.displayName || t.noName}
        </label>
      ))}
    </div>
  );
}

function NewListModal({ people, onClose }: { people: Profile[]; onClose(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<ListFormValue>(EMPTY_LIST_FORM);
  // Si sólo hay otra persona, ya viene elegida.
  const [memberIds, setMemberIds] = useState<string[]>(() => (people.length === 1 ? [people[0]!.id] : []));
  const [busy, setBusy] = useState(false);
  const t = useT().lists.index;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const id = await backend.lists.create({ ...form, dueOn: form.dueOn || null, memberIds });
      burst([form.emoji, "✨", "💖"], 20);
      toast.success(t.created, memberIds.length ? t.createdBody : undefined);
      navigate(`/listas/${id}`);
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal title={t.newList} onClose={onClose}>
      <form className="stack" onSubmit={create}>
        <div className="field">
          <span className="field__label">{t.withWhom}</span>
          <PeoplePicker people={people} selected={memberIds} onChange={setMemberIds} />
        </div>
        <ListFields value={form} onChange={setForm} />
        <button className="btn" disabled={busy || !form.title.trim()}>{busy ? t.creating : t.create}</button>
      </form>
    </Modal>
  );
}

function ListCard({ list, names, people }: { list: TodoListSummary; names: string; people: Profile[] }) {
  const complete = list.total > 0 && list.done === list.total;
  const t = useT().lists;
  return (
    <Link to={`/listas/${list.id}`} className="list-card card card--interactive">
      <span className="list-card__emoji" aria-hidden>{list.emoji}</span>
      <span className="list-card__body">
        <strong className="list-card__title">{list.title}</strong>
        <span className="muted list-card__people"><AvatarStack people={people} size={22} /> {names ? t.withPeople(names) : t.onlyYou}</span>
        <ProgressBar done={list.done} total={list.total} />
        <span className="row list-card__meta">
          <span className="muted">{list.total === 0 ? t.noTasks : complete ? t.allDone : t.progress(list.done, list.total)}</span>
          {list.nextDue && !complete && <DueBadge dueOn={list.nextDue} />}
        </span>
      </span>
    </Link>
  );
}

export default function ListsPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.lists.list(), backend.users.listProfiles(), backend.users.listRolePermissions()]),
    [backend],
  );
  const [lists = [], profiles = [], rolePermissions = []] = data ?? [];
  const people = useMemo(
    () => profiles.filter((p) => p.id !== user?.id && canUseLists(p, rolePermissions)),
    [profiles, rolePermissions, user?.id],
  );
  const i18n = useT();
  const t = i18n.lists.index;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName || i18n.common.someone;

  useEffect(
    () => backend.realtime.subscribe(["todo_lists", "todo_list_members", "todo_items"], () => void reload()),
    [backend, reload],
  );

  return (
    <main id="contenido-principal" className="container lists">
      <header className="lists__header row-between">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
        <button className="btn" data-tour="lists-new" onClick={() => setCreating(true)}>{t.newButton}</button>
      </header>
      {loading && !data ? <PageLoader /> : lists.length === 0 ? (
        <EmptyState icon="📝" title={t.empty}>
          <p className="muted">{t.emptyHint}</p>
          <button className="btn btn--soft" onClick={() => setCreating(true)}>{t.createFirst}</button>
        </EmptyState>
      ) : (
        <div className="list-grid" data-tour="lists-grid">
          {lists.map((l) => {
            const otherIds = l.memberIds.filter((id) => id !== user?.id);
            return (
              <ListCard key={l.id} list={l} names={joinNames(otherIds.map(nameOf))}
                people={otherIds.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p)} />
            );
          })}
        </div>
      )}
      {creating && <NewListModal people={people} onClose={() => setCreating(false)} />}
    </main>
  );
}
