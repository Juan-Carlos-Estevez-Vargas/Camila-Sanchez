import { describe, expect, it } from "vitest";
import { buildTasks, canUseLists, dueLabel, dueState, joinNames, materialsLabel, nextDueOf, progressOf, punctualityOf, taskStatusOf, timelinessLabel, timelinessOf } from "./lists";
import type { TodoItem } from "./types";

const NOW = new Date("2026-10-21T10:00:00");

const item = (id: string, patch: Partial<TodoItem> = {}): TodoItem => ({
  id, listId: "l", parentId: null, title: id, description: "", dueOn: null, assigneeId: null,
  startedAt: null, startedBy: null, doneAt: null, doneBy: null, doneDueOn: null, position: 0, createdBy: null, createdAt: "2026-10-21T00:00:00Z", ...patch,
});

describe("tareas de una lista", () => {
  it("separa en progreso, pendientes y hechas, con sus subtareas en orden", () => {
    const { inProgress, pending, done } = buildTasks([
      item("c", { position: 3, startedAt: "2026-10-21T00:00:00Z" }),
      item("b", { position: 2 }),
      item("a", { position: 1 }),
      item("a2", { parentId: "a", position: 2 }),
      item("a1", { parentId: "a", position: 1 }),
      item("viejo", { doneAt: "2026-10-20T00:00:00Z" }),
      item("nuevo", { doneAt: "2026-10-21T00:00:00Z" }),
    ]);
    expect(inProgress.map((n) => n.item.id)).toEqual(["c"]);
    expect(pending.map((n) => n.item.id)).toEqual(["a", "b"]);
    expect(pending[0]!.subtasks.map((s) => s.id)).toEqual(["a1", "a2"]);
    expect(done.map((n) => n.item.id)).toEqual(["nuevo", "viejo"]);
  });

  it("el avance cuenta sólo las tareas, no las subtareas", () => {
    expect(progressOf([item("a", { doneAt: "x" }), item("b"), item("s", { parentId: "b", doneAt: "x" })]))
      .toEqual({ total: 2, done: 1, percent: 50 });
    expect(progressOf([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("la próxima fecha es la más cercana de lo pendiente, o la de la lista", () => {
    expect(nextDueOf([item("a", { dueOn: "2026-12-01" }), item("b", { dueOn: "2026-11-01" }), item("c", { dueOn: "2026-10-01", doneAt: "x" })]))
      .toBe("2026-11-01");
    expect(nextDueOf([item("a")], "2026-12-24")).toBe("2026-12-24");
  });
});

describe("estado de una tarea", () => {
  it("sale de cuándo se empezó y cuándo se terminó", () => {
    expect(taskStatusOf(item("a"))).toBe("pending");
    expect(taskStatusOf(item("a", { startedAt: "x" }))).toBe("in_progress");
    expect(taskStatusOf(item("a", { startedAt: "x", doneAt: "y" }))).toBe("done");
    expect(taskStatusOf(item("a", { doneAt: "y" }))).toBe("done");
  });

  it("dice si se hizo a tiempo o con cuántos días de retraso", () => {
    const done = (doneAt: string, doneDueOn: string | null) => item("a", { doneAt, doneDueOn });
    expect(timelinessOf(item("a", { doneDueOn: "2026-10-21" }))).toBeNull();
    expect(timelinessOf(done("2026-10-21T10:00:00", null))).toBeNull();
    expect(timelinessOf(done("2026-10-21T23:30:00", "2026-10-21"))).toEqual({ onTime: true, lateDays: 0, earlyDays: 0 });
    expect(timelinessOf(done("2026-10-19T10:00:00", "2026-10-21"))).toEqual({ onTime: true, lateDays: 0, earlyDays: 2 });
    expect(timelinessOf(done("2026-10-24T08:00:00", "2026-10-21"))).toEqual({ onTime: false, lateDays: 3, earlyDays: 0 });
  });

  it("lo describe en palabras", () => {
    expect(timelinessLabel({ onTime: true, lateDays: 0, earlyDays: 0 })).toBe("A tiempo");
    expect(timelinessLabel({ onTime: true, lateDays: 0, earlyDays: 1 })).toBe("A tiempo · 1 día antes");
    expect(timelinessLabel({ onTime: false, lateDays: 1, earlyDays: 0 })).toBe("Con 1 día de retraso");
    expect(timelinessLabel({ onTime: false, lateDays: 4, earlyDays: 0 })).toBe("Con 4 días de retraso");
  });

  it("cuenta cuántas tareas se hicieron a tiempo y cuántas tarde (no las subtareas)", () => {
    expect(punctualityOf([
      item("a", { doneAt: "2026-10-20T10:00:00", doneDueOn: "2026-10-21" }),
      item("b", { doneAt: "2026-10-22T10:00:00", doneDueOn: "2026-10-21" }),
      item("c", { doneAt: "2026-10-22T10:00:00" }),
      item("s", { parentId: "a", doneAt: "2026-10-25T10:00:00", doneDueOn: "2026-10-21" }),
      item("d", { dueOn: "2026-10-01" }),
    ])).toEqual({ onTime: 1, late: 1 });
  });
});

describe("fechas límite", () => {
  it("dice si venció, vence hoy, pronto o más adelante", () => {
    expect(dueState("2026-10-20", NOW)).toBe("overdue");
    expect(dueState("2026-10-21", NOW)).toBe("today");
    expect(dueState("2026-10-24", NOW)).toBe("soon");
    expect(dueState("2026-10-25", NOW)).toBe("later");
  });

  it("las describe en palabras", () => {
    expect(dueLabel("2026-10-21", NOW)).toBe("Vence hoy");
    expect(dueLabel("2026-10-22", NOW)).toBe("Mañana");
    expect(dueLabel("2026-10-20", NOW)).toBe("Venció ayer");
    expect(dueLabel("2026-10-18", NOW)).toBe("Venció hace 3 días");
    expect(dueLabel("2026-10-26", NOW)).toBe("En 5 días");
    expect(dueLabel("2026-12-24", NOW)).toMatch(/24 de diciembre de 2026/);
  });
});

it("cuenta los materiales listos", () => {
  expect(materialsLabel([{ isReady: true }, { isReady: false }])).toBe("1 de 2 listos");
  expect(materialsLabel([{ isReady: true }])).toBe("1 de 1 listo");
});

it("sólo se comparte con personas activas que pueden usar listas", () => {
  const perms = [{ role: "viewer" as const, permission: "lists.use" }];
  expect(canUseLists({ role: "viewer", isActive: true }, perms)).toBe(true);
  expect(canUseLists({ role: "viewer", isActive: false }, perms)).toBe(false);
  expect(canUseLists({ role: "editor", isActive: true }, perms)).toBe(false);
  expect(canUseLists({ role: "super_admin", isActive: true }, [])).toBe(true);
});

it("junta nombres como en una frase", () => {
  expect(joinNames(["Juan"])).toBe("Juan");
  expect(joinNames(["Juan", "Camila"])).toBe("Juan y Camila");
  expect(joinNames(["Juan", "Ana", "Camila"])).toBe("Juan, Ana y Camila");
});
