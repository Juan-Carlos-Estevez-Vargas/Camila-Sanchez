import { describe, expect, it } from "vitest";
import { buildTasks, canUseLists, dueLabel, dueState, joinNames, materialsLabel, nextDueOf, progressOf } from "./lists";
import type { TodoItem } from "./types";

const NOW = new Date("2026-10-21T10:00:00");

const item = (id: string, patch: Partial<TodoItem> = {}): TodoItem => ({
  id, listId: "l", parentId: null, title: id, description: "", dueOn: null, assigneeId: null,
  doneAt: null, doneBy: null, position: 0, createdBy: null, createdAt: "2026-10-21T00:00:00Z", ...patch,
});

describe("tareas de una lista", () => {
  it("separa pendientes y hechas, con sus subtareas en orden", () => {
    const { pending, done } = buildTasks([
      item("b", { position: 2 }),
      item("a", { position: 1 }),
      item("a2", { parentId: "a", position: 2 }),
      item("a1", { parentId: "a", position: 1 }),
      item("viejo", { doneAt: "2026-10-20T00:00:00Z" }),
      item("nuevo", { doneAt: "2026-10-21T00:00:00Z" }),
    ]);
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
