import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { canUseLists, joinNames } from "@/domain/lists";
import type { Profile, TodoListSummary } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { burst } from "@/features/site/effects/FloatingEffects";
import { DueBadge, EMPTY_LIST_FORM, ListFields, ProgressBar, type ListFormValue } from "./listParts";
import "./styles/lists.scss";

/** Casillas para elegir con quién se comparte. */
export function PeoplePicker({ people, selected, onChange }: { people: Profile[]; selected: string[]; onChange(ids: string[]): void }) {
  if (people.length === 0) return <p className="muted">Todavía no hay nadie más con quien compartirla.</p>;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="people-picker">
      {people.map((p) => (
        <label key={p.id} className={`people-picker__option${selected.includes(p.id) ? " is-active" : ""}`}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
          <span className="avatar" aria-hidden>{p.displayName.slice(0, 1).toUpperCase() || "?"}</span>
          {p.displayName || "Sin nombre"}
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

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const id = await backend.lists.create({ ...form, dueOn: form.dueOn || null, memberIds });
      burst([form.emoji, "✨", "💖"], 20);
      toast.success("Lista creada 📝", memberIds.length ? "Les llegó un aviso a quienes sumaste." : undefined);
      navigate(`/listas/${id}`);
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  return (
    <Modal title="Nueva lista" onClose={onClose}>
      <form className="stack" onSubmit={create}>
        <div className="field">
          <span className="field__label">¿Con quién?</span>
          <PeoplePicker people={people} selected={memberIds} onChange={setMemberIds} />
        </div>
        <ListFields value={form} onChange={setForm} />
        <button className="btn" disabled={busy || !form.title.trim()}>{busy ? "Creando…" : "Crear lista"}</button>
      </form>
    </Modal>
  );
}

function ListCard({ list, names }: { list: TodoListSummary; names: string }) {
  const complete = list.total > 0 && list.done === list.total;
  return (
    <Link to={`/listas/${list.id}`} className="list-card card card--interactive">
      <span className="list-card__emoji" aria-hidden>{list.emoji}</span>
      <span className="list-card__body">
        <strong className="list-card__title">{list.title}</strong>
        <span className="muted list-card__people">{names ? `Con ${names}` : "Sólo tú"}</span>
        <ProgressBar done={list.done} total={list.total} />
        <span className="row list-card__meta">
          <span className="muted">{list.total === 0 ? "Sin tareas todavía" : complete ? "¡Todo listo! 🎉" : `${list.done} de ${list.total} hechas`}</span>
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
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName || "Alguien";

  useEffect(
    () => backend.realtime.subscribe(["todo_lists", "todo_list_members", "todo_items"], () => void reload()),
    [backend, reload],
  );

  return (
    <main id="contenido-principal" className="container lists">
      <header className="lists__header row-between">
        <div>
          <h1>Listas</h1>
          <p className="muted">Cosas por hacer con alguien más: tareas, subtareas, materiales, fotos y fechas.</p>
        </div>
        <button className="btn" data-tour="lists-new" onClick={() => setCreating(true)}>+ Nueva lista</button>
      </header>
      {loading && !data ? <PageLoader /> : lists.length === 0 ? (
        <EmptyState icon="📝" title="Aún no tienes listas">
          <p className="muted">Crea una, elige con quién compartirla y empiecen a tachar cosas juntos.</p>
          <button className="btn btn--soft" onClick={() => setCreating(true)}>Crear la primera</button>
        </EmptyState>
      ) : (
        <div className="list-grid" data-tour="lists-grid">
          {lists.map((l) => (
            <ListCard key={l.id} list={l} names={joinNames(l.memberIds.filter((id) => id !== user?.id).map(nameOf))} />
          ))}
        </div>
      )}
      {creating && <NewListModal people={people} onClose={() => setCreating(false)} />}
    </main>
  );
}
