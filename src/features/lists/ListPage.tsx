import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { buildTasks, joinNames, materialsLabel, progressOf, type TaskNode } from "@/domain/lists";
import type { Profile, TodoItem, TodoListDetail } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { AvatarStack } from "@/ui/Avatar";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { useAsync } from "@/ui/useAsync";
import { burst } from "@/features/site/effects/FloatingEffects";
import { DueBadge, ProgressBar } from "./listParts";
import { ListSettings } from "./ListSettings";
import { TaskEditor } from "./TaskEditor";
import "./styles/lists.scss";

const REALTIME_TABLES = ["todo_lists", "todo_list_members", "todo_items", "todo_materials", "todo_item_images"] as const;

interface RowProps {
  node: TaskNode;
  detail: TodoListDetail;
  nameOf(id: string | null): string;
  onToggle(item: TodoItem): void;
  onOpen(item: TodoItem): void;
}

function TaskRow({ node, detail, nameOf, onToggle, onOpen }: RowProps) {
  const { item, subtasks } = node;
  const done = !!item.doneAt;
  const materials = detail.materials.filter((m) => m.itemId === item.id);
  const photos = detail.images.filter((i) => i.itemId === item.id).length;
  const subDone = subtasks.filter((s) => s.doneAt).length;
  return (
    <li className={`task${done ? " is-done" : ""}`}>
      <div className="task__main">
        <input type="checkbox" className="check" checked={done} onChange={() => onToggle(item)} aria-label={`Hecha: «${item.title}»`} />
        <button className="task__open" onClick={() => onOpen(item)}>
          <span className="task__title">{item.title}</span>
          <span className="task__meta">
            {item.dueOn && <DueBadge dueOn={item.dueOn} done={done} />}
            {item.assigneeId && <span className="badge badge--muted"><span aria-hidden>👤 </span><span className="visually-hidden">Encargada: </span>{nameOf(item.assigneeId)}</span>}
            {subtasks.length > 0 && <span className="badge badge--muted"><span aria-hidden>☑️ </span>{subDone}/{subtasks.length}<span className="visually-hidden"> subtareas hechas</span></span>}
            {materials.length > 0 && <span className="badge badge--muted"><span aria-hidden>🧰 </span><span className="visually-hidden">Materiales: </span>{materialsLabel(materials)}</span>}
            {photos > 0 && <span className="badge badge--muted"><span aria-hidden>📷 </span>{photos}<span className="visually-hidden"> {photos === 1 ? "foto" : "fotos"}</span></span>}
            {item.description.trim() && <span className="badge badge--muted" title="Tiene descripción"><span aria-hidden>📝</span><span className="visually-hidden">Tiene descripción</span></span>}
            {done && item.doneBy && <span className="muted task__by">Hecha por {nameOf(item.doneBy)}</span>}
          </span>
        </button>
      </div>
      {subtasks.length > 0 && !done && (
        <ul className="task__subtasks">
          {subtasks.map((s) => (
            <li key={s.id} className={`subtask${s.doneAt ? " is-done" : ""}`}>
              <input type="checkbox" className="check check--sm" checked={!!s.doneAt} onChange={() => onToggle(s)} aria-label={`Subtarea hecha: «${s.title}»`} />
              <button className="subtask__open" onClick={() => onOpen(item)}>{s.title}</button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ListPage() {
  const { id = "" } = useParams();
  const backend = useBackend();
  const { user } = useAuth();
  const toast = useToast();
  const { items: notifications, markRead } = useNotifications();
  const [title, setTitle] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const { data, loading, reload, setData } = useAsync(
    () => Promise.all([backend.lists.get(id), backend.users.listProfiles(), backend.users.listRolePermissions()]),
    [backend, id],
  );
  const [detail, profiles = [], rolePermissions = []] = data ?? [];

  // Lo que cambian los demás llega en vivo (agrupado para no recargar de más).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = backend.realtime.subscribe([...REALTIME_TABLES], () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void reload(), 250);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [backend, reload]);

  // Estando en la lista, sus avisos se dan por vistos.
  useEffect(() => {
    for (const n of notifications) {
      if (!n.readAt && n.kind === "list" && n.link?.startsWith(`/listas/${id}`)) void markRead(n.id);
    }
  }, [notifications, id, markRead]);

  const nameOf = useCallback(
    (userId: string | null) => (userId === user?.id ? "ti" : profiles.find((p) => p.id === userId)?.displayName || "Alguien"),
    [profiles, user?.id],
  );
  const members = useMemo<Profile[]>(
    () => (detail ? detail.list.memberIds.map((mid) => profiles.find((p) => p.id === mid)).filter((p): p is Profile => !!p) : []),
    [detail, profiles],
  );
  const tasks = useMemo(() => buildTasks(detail?.items ?? []), [detail]);
  const progress = progressOf(detail?.items ?? []);

  if (loading && !data) return <main id="contenido-principal" className="container lists"><PageLoader /></main>;
  if (!detail) {
    return (
      <main id="contenido-principal" className="container lists">
        <EmptyState icon="🔒" title="Esta lista no existe o ya no eres parte de ella">
          <Link to="/listas" className="btn btn--soft">Ver mis listas</Link>
        </EmptyState>
      </main>
    );
  }
  const { list } = detail;
  const otherMembers = members.filter((m) => m.id !== user?.id);
  const others = otherMembers.map((m) => m.displayName || "Alguien");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    // Se limpia al instante para poder escribir la siguiente sin esperar.
    setTitle("");
    try {
      await backend.lists.saveItem({ listId: list.id, title: text });
      await reload();
    } catch (error) {
      toast.error(error);
      setTitle((current) => current || text);
    }
  };

  const toggle = async (item: TodoItem) => {
    const done = !item.doneAt;
    // Se marca al instante; si falla, se recarga lo real.
    setData((current) => {
      if (!current?.[0]) return current!;
      const [d, ...rest] = current;
      return [{ ...d!, items: d!.items.map((i) => (i.id === item.id ? { ...i, doneAt: done ? new Date().toISOString() : null, doneBy: done ? user?.id ?? null : null } : i)) }, ...rest];
    });
    if (done) {
      const remaining = detail.items.filter((i) => !i.parentId && !i.doneAt && i.id !== item.id).length;
      burst(!item.parentId && remaining === 0 ? ["🎉", "💖", "✨", "🥳"] : ["✅", "💖"], !item.parentId && remaining === 0 ? 40 : 12);
    }
    try {
      await backend.lists.setItemDone(item.id, done);
    } catch (error) {
      toast.error(error);
    }
    await reload();
  };

  const openItem = openId ? detail.items.find((i) => i.id === openId) ?? null : null;

  return (
    <main id="contenido-principal" className="container lists list-page">
      <Link to="/listas" className="list-page__back">← Mis listas</Link>
      <header className="list-page__header">
        <span className="list-page__emoji" aria-hidden>{list.emoji}</span>
        <div className="grow">
          <h1>{list.title}</h1>
          <p className="muted list-page__people" data-tour="list-people"><AvatarStack people={otherMembers} size={24} /> {others.length ? `Con ${joinNames(others)}` : "Sólo tú (súmale gente en Ajustes)"}</p>
        </div>
        <button className="btn btn--soft btn--sm" data-tour="list-settings" onClick={() => setSettings(true)}>⚙️ Ajustes</button>
      </header>
      {list.description.trim() && <p className="list-page__description">{list.description}</p>}
      <div className="list-page__progress card">
        <div className="row-between">
          <strong>{progress.total === 0 ? "Sin tareas todavía" : progress.done === progress.total ? "¡Todo listo! 🎉" : `${progress.done} de ${progress.total} hechas`}</strong>
          {list.dueOn && <DueBadge dueOn={list.dueOn} done={progress.total > 0 && progress.done === progress.total} />}
        </div>
        <ProgressBar done={progress.done} total={progress.total} />
      </div>

      <form className="list-page__add card" onSubmit={add} data-tour="list-add">
        <input className="input grow" maxLength={300} placeholder="Agrega una tarea…" aria-label="Nueva tarea" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn" disabled={!title.trim()}>Agregar</button>
      </form>

      {tasks.pending.length === 0 && tasks.done.length === 0 ? (
        <EmptyState icon="🌱" title="La lista está vacía">Escribe arriba la primera tarea. Luego tócala para agregarle subtareas, materiales, fotos y fecha.</EmptyState>
      ) : (
        <>
          {tasks.pending.length > 0 ? (
            <ul className="tasks" data-tour="list-tasks">
              {tasks.pending.map((node) => (
                <TaskRow key={node.item.id} node={node} detail={detail} nameOf={nameOf} onToggle={(i) => void toggle(i)} onOpen={(i) => setOpenId(i.id)} />
              ))}
            </ul>
          ) : (
            <p className="muted center">Nada pendiente 🎉</p>
          )}
          {tasks.done.length > 0 && (
            <details className="tasks-done">
              <summary>Hechas ({tasks.done.length})</summary>
              <ul className="tasks">
                {tasks.done.map((node) => (
                  <TaskRow key={node.item.id} node={node} detail={detail} nameOf={nameOf} onToggle={(i) => void toggle(i)} onOpen={(i) => setOpenId(i.id)} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {openItem && (
        <TaskEditor key={openItem.id} item={openItem} detail={detail} members={members} nameOf={nameOf}
          onChanged={reload} onToggle={(i) => void toggle(i)} onClose={() => setOpenId(null)} />
      )}
      {settings && (
        <ListSettings detail={detail} profiles={profiles} rolePermissions={rolePermissions} onChanged={reload} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
