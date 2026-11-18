import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { buildTasks, joinNames, materialsLabel, progressOf, punctualityOf, taskStatusOf, type TaskNode } from "@/domain/lists";
import type { Profile, TaskStatus, TodoItem, TodoListDetail } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { AvatarStack } from "@/ui/Avatar";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { useAsync } from "@/ui/useAsync";
import { burst } from "@/features/site/effects/FloatingEffects";
import { DueBadge, ProgressBar, TimelinessBadge } from "./listParts";
import { ListSettings } from "./ListSettings";
import { TaskEditor } from "./TaskEditor";
import "./styles/lists.scss";
import { useT } from "@/i18n";

const REALTIME_TABLES = ["todo_lists", "todo_list_members", "todo_items", "todo_materials", "todo_item_images"] as const;

interface RowProps {
  node: TaskNode;
  detail: TodoListDetail;
  nameOf(id: string | null): string;
  onToggle(item: TodoItem): void;
  onStatus(item: TodoItem, status: TaskStatus): void;
  onOpen(item: TodoItem): void;
}

function TaskRow({ node, detail, nameOf, onToggle, onStatus, onOpen }: RowProps) {
  const { item, subtasks } = node;
  const done = !!item.doneAt;
  const materials = detail.materials.filter((m) => m.itemId === item.id);
  const photos = detail.images.filter((i) => i.itemId === item.id).length;
  const subDone = subtasks.filter((s) => s.doneAt).length;
  const status = taskStatusOf(item);
  const t = useT().lists.page;
  return (
    <li className={`task task--${status.replace("_", "-")}${done ? " is-done" : ""}`}>
      <div className="task__main">
        <input type="checkbox" className="check" checked={done} onChange={() => onToggle(item)} aria-label={t.doneLabel(item.title)} />
        <button className="task__open" onClick={() => onOpen(item)}>
          <span className="task__title">{item.title}</span>
          <span className="task__meta">
            {done ? <TimelinessBadge item={item} /> : item.dueOn && <DueBadge dueOn={item.dueOn} />}
            {status === "in_progress" && item.startedBy && <span className="muted task__by">{t.startedBy(nameOf(item.startedBy))}</span>}
            {item.assigneeId && <span className="badge badge--muted"><span aria-hidden>👤 </span><span className="visually-hidden">{t.assignee}</span>{nameOf(item.assigneeId)}</span>}
            {subtasks.length > 0 && <span className="badge badge--muted"><span aria-hidden>☑️ </span>{subDone}/{subtasks.length}<span className="visually-hidden">{t.subtasksDone}</span></span>}
            {materials.length > 0 && <span className="badge badge--muted"><span aria-hidden>🧰 </span><span className="visually-hidden">{t.materials}</span>{materialsLabel(materials)}</span>}
            {photos > 0 && <span className="badge badge--muted"><span aria-hidden>📷 </span>{photos}<span className="visually-hidden">{t.photos(photos)}</span></span>}
            {item.description.trim() && <span className="badge badge--muted" title={t.hasDescription}><span aria-hidden>📝</span><span className="visually-hidden">{t.hasDescription}</span></span>}
            {done && item.doneBy && <span className="muted task__by">{t.doneBy(nameOf(item.doneBy))}</span>}
          </span>
        </button>
        {status === "pending" && (
          <button className="btn btn--soft btn--sm task__start" onClick={() => onStatus(item, "in_progress")} aria-label={t.startLabel(item.title)}>{t.start}</button>
        )}
      </div>
      {subtasks.length > 0 && !done && (
        <ul className="task__subtasks">
          {subtasks.map((s) => (
            <li key={s.id} className={`subtask${s.doneAt ? " is-done" : ""}`}>
              <input type="checkbox" className="check check--sm" checked={!!s.doneAt} onChange={() => onToggle(s)} aria-label={t.subtaskDone(s.title)} />
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

  const i18n = useT();
  const t = i18n.lists;
  const nameOf = useCallback(
    (userId: string | null) => (userId === user?.id ? i18n.lists.you : profiles.find((p) => p.id === userId)?.displayName || i18n.common.someone),
    [profiles, user?.id, i18n],
  );
  const members = useMemo<Profile[]>(
    () => (detail ? detail.list.memberIds.map((mid) => profiles.find((p) => p.id === mid)).filter((p): p is Profile => !!p) : []),
    [detail, profiles],
  );
  const tasks = useMemo(() => buildTasks(detail?.items ?? []), [detail]);
  const progress = progressOf(detail?.items ?? []);
  const punctuality = punctualityOf(detail?.items ?? []);

  if (loading && !data) return <main id="contenido-principal" className="container lists"><PageLoader /></main>;
  if (!detail) {
    return (
      <main id="contenido-principal" className="container lists">
        <EmptyState icon="🔒" title={t.page.missing}>
          <Link to="/listas" className="btn btn--soft">{t.page.myLists}</Link>
        </EmptyState>
      </main>
    );
  }
  const { list } = detail;
  const otherMembers = members.filter((m) => m.id !== user?.id);
  const others = otherMembers.map((m) => m.displayName || i18n.common.someone);

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

  const setStatus = async (item: TodoItem, status: TaskStatus) => {
    if (taskStatusOf(item) === status) return;
    const now = new Date().toISOString();
    // Se cambia al instante (como lo haría la base); si falla, se recarga lo real.
    const next = (i: TodoItem): TodoItem => status === "done"
      ? { ...i, doneAt: now, doneBy: user?.id ?? null, doneDueOn: i.dueOn }
      : { ...i, doneAt: null, doneBy: null, doneDueOn: null,
        ...(status === "pending" ? { startedAt: null, startedBy: null } : i.startedAt ? {} : { startedAt: now, startedBy: user?.id ?? null }) };
    setData((current) => {
      if (!current?.[0]) return current!;
      const [d, ...rest] = current;
      return [{ ...d!, items: d!.items.map((i) => (i.id === item.id ? next(i) : i)) }, ...rest];
    });
    if (status === "done") {
      const remaining = detail.items.filter((i) => !i.parentId && !i.doneAt && i.id !== item.id).length;
      burst(!item.parentId && remaining === 0 ? ["🎉", "💖", "✨", "🥳"] : ["✅", "💖"], !item.parentId && remaining === 0 ? 40 : 12);
    }
    try {
      await backend.lists.setItemStatus(item.id, status);
    } catch (error) {
      toast.error(error);
    }
    await reload();
  };

  // La casilla marca como hecha; al desmarcarla vuelve a «en progreso» si ya se había empezado.
  const toggle = (item: TodoItem) => setStatus(item, item.doneAt ? (item.startedAt ? "in_progress" : "pending") : "done");

  const row = (node: TaskNode) => (
    <TaskRow key={node.item.id} node={node} detail={detail} nameOf={nameOf}
      onToggle={(i) => void toggle(i)} onStatus={(i, st) => void setStatus(i, st)} onOpen={(i) => setOpenId(i.id)} />
  );

  const openItem = openId ? detail.items.find((i) => i.id === openId) ?? null : null;

  return (
    <main id="contenido-principal" className="container lists list-page">
      <Link to="/listas" className="list-page__back">{t.page.back}</Link>
      <header className="list-page__header">
        <span className="list-page__emoji" aria-hidden>{list.emoji}</span>
        <div className="grow">
          <h1>{list.title}</h1>
          <p className="muted list-page__people" data-tour="list-people"><AvatarStack people={otherMembers} size={24} /> {others.length ? t.withPeople(joinNames(others)) : t.page.onlyYouHint}</p>
        </div>
        <button className="btn btn--soft btn--sm" data-tour="list-settings" onClick={() => setSettings(true)}>{t.page.settings}</button>
      </header>
      {list.description.trim() && <p className="list-page__description">{list.description}</p>}
      <div className="list-page__progress card">
        <div className="row-between">
          <strong>{progress.total === 0 ? t.noTasks : progress.done === progress.total ? t.allDone : t.progress(progress.done, progress.total)}</strong>
          {list.dueOn && <DueBadge dueOn={list.dueOn} done={progress.total > 0 && progress.done === progress.total} />}
        </div>
        <ProgressBar done={progress.done} total={progress.total} />
        {(punctuality.onTime > 0 || punctuality.late > 0 || tasks.inProgress.length > 0) && (
          <p className="list-page__stats">
            {tasks.inProgress.length > 0 && <span className="badge"><span aria-hidden>{t.statusIcon.in_progress} </span>{t.page.inProgressSection(tasks.inProgress.length)}</span>}
            {punctuality.onTime > 0 && <span className="badge badge--success"><span aria-hidden>⏱️ </span>{t.punctuality(punctuality.onTime, 0)}</span>}
            {punctuality.late > 0 && <span className="badge badge--danger"><span aria-hidden>🐢 </span>{t.punctuality(0, punctuality.late)}</span>}
          </p>
        )}
      </div>

      <form className="list-page__add card" onSubmit={add} data-tour="list-add">
        <input className="input grow" maxLength={300} placeholder={t.page.addPlaceholder} aria-label={t.page.newTask} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn" disabled={!title.trim()}>{t.add}</button>
      </form>

      {tasks.inProgress.length === 0 && tasks.pending.length === 0 && tasks.done.length === 0 ? (
        <EmptyState icon="🌱" title={t.page.empty}>{t.page.emptyHint}</EmptyState>
      ) : (
        <>
          {tasks.inProgress.length > 0 && (
            <section className="tasks-group" aria-labelledby="tasks-in-progress">
              <h2 id="tasks-in-progress" className="tasks-group__title"><span aria-hidden>{t.statusIcon.in_progress} </span>{t.page.inProgressSection(tasks.inProgress.length)}</h2>
              <ul className="tasks">
                {tasks.inProgress.map((node) => row(node))}
              </ul>
            </section>
          )}
          {tasks.pending.length > 0 ? (
            <section className="tasks-group" aria-labelledby="tasks-pending" data-tour="list-tasks">
              {tasks.inProgress.length > 0 && <h2 id="tasks-pending" className="tasks-group__title"><span aria-hidden>{t.statusIcon.pending} </span>{t.page.pendingSection(tasks.pending.length)}</h2>}
              <ul className="tasks" aria-label={tasks.inProgress.length > 0 ? undefined : t.page.pendingSection(tasks.pending.length)}>
                {tasks.pending.map((node) => row(node))}
              </ul>
            </section>
          ) : tasks.inProgress.length === 0 && (
            <p className="muted center">{t.page.nothingPending}</p>
          )}
          {tasks.done.length > 0 && (
            <details className="tasks-done">
              <summary>{t.page.doneSection(tasks.done.length)}</summary>
              <ul className="tasks">
                {tasks.done.map((node) => row(node))}
              </ul>
            </details>
          )}
        </>
      )}

      {openItem && (
        <TaskEditor key={openItem.id} item={openItem} detail={detail} members={members} nameOf={nameOf}
          onChanged={reload} onToggle={(i) => void toggle(i)} onStatus={(i, st) => void setStatus(i, st)} onClose={() => setOpenId(null)} />
      )}
      {settings && (
        <ListSettings detail={detail} profiles={profiles} rolePermissions={rolePermissions} onChanged={reload} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
