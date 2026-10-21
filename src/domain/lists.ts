/**
 * Reglas de las listas compartidas que no dependen de la interfaz: avance,
 * orden de las tareas y cómo se describe una fecha límite.
 */
import { daysUntil, formatLongDate, parseIsoDate } from "./dates";
import { PERMISSIONS } from "./permissions";
import type { IsoDate, Profile, RolePermission, TodoItem, TodoMaterial } from "./types";

export const LIST_EMOJIS = ["📝", "🛒", "🏖️", "🏠", "🎁", "🎉", "✈️", "🍳", "💪", "📚", "🌱", "💖"] as const;

export const MAX_TASK_IMAGES = 12;

/** Una tarea con sus subtareas ya ordenadas. */
export interface TaskNode {
  item: TodoItem;
  subtasks: TodoItem[];
}

const byPosition = (a: TodoItem, b: TodoItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

/** Arma el árbol de tareas: pendientes primero (en su orden) y luego las hechas. */
export function buildTasks(items: readonly TodoItem[]): { pending: TaskNode[]; done: TaskNode[] } {
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
    pending: nodes.filter((n) => !n.item.doneAt),
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
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Venció ayer";
  if (days < 0) return `Venció hace ${-days} días`;
  if (days <= 7) return `En ${days} días`;
  return formatLongDate(dueOn);
}

/** «2 de 3 listos» para los materiales de una tarea. */
export function materialsLabel(materials: readonly Pick<TodoMaterial, "isReady">[]): string {
  const ready = materials.filter((m) => m.isReady).length;
  return `${ready} de ${materials.length} listo${materials.length === 1 ? "" : "s"}`;
}

/** ¿Se le puede compartir una lista a esta persona? (activa y con lists.use) */
export function canUseLists(profile: Pick<Profile, "role" | "isActive">, rolePermissions: readonly RolePermission[]): boolean {
  return profile.isActive && (profile.role === "super_admin"
    || rolePermissions.some((rp) => rp.role === profile.role && rp.permission === PERMISSIONS.listsUse));
}

/** «Juan», «Juan y Camila», «Juan, Ana y Camila». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
