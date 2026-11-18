/**
 * Reglas de las listas compartidas que no dependen de la interfaz: avance,
 * orden de las tareas y cómo se describe una fecha límite.
 */
import { daysUntil, formatLongDate, parseIsoDate } from "./dates";
import { PERMISSIONS } from "./permissions";
import type { IsoDate, Profile, RolePermission, TaskStatus, TodoItem, TodoMaterial } from "./types";
import { msg } from "@/i18n/store";

export const LIST_EMOJIS = ["📝", "🛒", "🏖️", "🏠", "🎁", "🎉", "✈️", "🍳", "💪", "📚", "🌱", "💖"] as const;

export const MAX_TASK_IMAGES = 12;

/** Una tarea con sus subtareas ya ordenadas. */
export interface TaskNode {
  item: TodoItem;
  subtasks: TodoItem[];
}

const byPosition = (a: TodoItem, b: TodoItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

/**
 * Arma el árbol de tareas en tres grupos: en progreso y pendientes (cada uno
 * en su orden) y las hechas.
 */
export function buildTasks(items: readonly TodoItem[]): { inProgress: TaskNode[]; pending: TaskNode[]; done: TaskNode[] } {
  const children = new Map<string, TodoItem[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = children.get(item.parentId) ?? [];
    list.push(item);
    children.set(item.parentId, list);
  }
  const nodes = items
    .filter((i) => !i.parentId)
    .sort(byPosition)
    .map((item) => ({ item, subtasks: (children.get(item.id) ?? []).sort(byPosition) }));
  return {
    inProgress: nodes.filter((n) => taskStatusOf(n.item) === "in_progress"),
    pending: nodes.filter((n) => taskStatusOf(n.item) === "pending"),
    // Las recién terminadas arriba.
    done: nodes.filter((n) => n.item.doneAt).sort((a, b) => (b.item.doneAt ?? "").localeCompare(a.item.doneAt ?? "")),
  };
}

/** Avance de una lista: sólo cuentan las tareas, no las subtareas. */
export function progressOf(items: readonly Pick<TodoItem, "parentId" | "doneAt">[]): { total: number; done: number; percent: number } {
  const tasks = items.filter((i) => !i.parentId);
  const done = tasks.filter((i) => i.doneAt).length;
  return { total: tasks.length, done, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

/** La fecha más cercana entre las tareas pendientes o, si no hay, la de la lista. */
export function nextDueOf(items: readonly Pick<TodoItem, "dueOn" | "doneAt">[], listDue: IsoDate | null = null): IsoDate | null {
  const dates = items.filter((i) => !i.doneAt && i.dueOn).map((i) => i.dueOn!).sort();
  return dates[0] ?? listDue;
}

export type DueState = "overdue" | "today" | "soon" | "later";

/** Qué tan cerca está una fecha límite («pronto» = en 3 días o menos). */
export function dueState(dueOn: IsoDate, now: Date = new Date()): DueState {
  const days = daysUntil(parseIsoDate(dueOn), now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= 3 ? "soon" : "later";
}

/** «Vence hoy», «Mañana», «Venció hace 2 días», «En 5 días» o la fecha. */
export function dueLabel(dueOn: IsoDate, now: Date = new Date()): string {
  const days = daysUntil(parseIsoDate(dueOn), now);
  const t = msg().lists.due;
  if (days === 0) return t.today;
  if (days === 1) return t.tomorrow;
  if (days === -1) return t.yesterday;
  if (days < 0) return t.ago(-days);
  if (days <= 7) return t.inDays(days);
  return formatLongDate(dueOn);
}

export const TASK_STATUSES: readonly TaskStatus[] = ["pending", "in_progress", "done"];

/** Pendiente, en progreso o hecha, según sus fechas. */
export function taskStatusOf(item: Pick<TodoItem, "startedAt" | "doneAt">): TaskStatus {
  if (item.doneAt) return "done";
  return item.startedAt ? "in_progress" : "pending";
}

/** Cómo terminó una tarea con fecha límite: a tiempo o con N días de retraso. */
export interface Timeliness {
  onTime: boolean;
  /** Días de retraso (0 si fue a tiempo). */
  lateDays: number;
  /** Días que sobraron (0 si se hizo el mismo día o tarde). */
  earlyDays: number;
}

/**
 * Compara el día en que se terminó (en la hora local) con la fecha límite que
 * tenía en ese momento. null si no está hecha o no tenía fecha.
 */
export function timelinessOf(item: Pick<TodoItem, "doneAt" | "doneDueOn">): Timeliness | null {
  if (!item.doneAt || !item.doneDueOn) return null;
  const diff = daysUntil(parseIsoDate(item.doneDueOn), new Date(item.doneAt));
  return { onTime: diff >= 0, lateDays: Math.max(-diff, 0), earlyDays: Math.max(diff, 0) };
}

/** «A tiempo», «A tiempo · 2 días antes» o «Con 3 días de retraso». */
export function timelinessLabel(timeliness: Timeliness): string {
  const t = msg().lists.timeliness;
  if (!timeliness.onTime) return t.late(timeliness.lateDays);
  return timeliness.earlyDays > 0 ? t.early(timeliness.earlyDays) : t.onTime;
}

/** Cuántas de las tareas hechas (con fecha) se hicieron a tiempo y cuántas tarde. */
export function punctualityOf(items: readonly Pick<TodoItem, "parentId" | "doneAt" | "doneDueOn">[]): { onTime: number; late: number } {
  let onTime = 0;
  let late = 0;
  for (const item of items) {
    if (item.parentId) continue;
    const result = timelinessOf(item);
    if (!result) continue;
    if (result.onTime) onTime++;
    else late++;
  }
  return { onTime, late };
}

/** «2 de 3 listos» para los materiales de una tarea. */
export function materialsLabel(materials: readonly Pick<TodoMaterial, "isReady">[]): string {
  const ready = materials.filter((m) => m.isReady).length;
  return msg().lists.materialsReady(ready, materials.length);
}

/** ¿Se le puede compartir una lista a esta persona? (activa y con lists.use) */
export function canUseLists(profile: Pick<Profile, "role" | "isActive">, rolePermissions: readonly RolePermission[]): boolean {
  return profile.isActive && (profile.role === "super_admin"
    || rolePermissions.some((rp) => rp.role === profile.role && rp.permission === PERMISSIONS.listsUse));
}

/** «Juan», «Juan y Camila», «Juan, Ana y Camila». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${msg().lists.and} ${names[names.length - 1]}`;
}
