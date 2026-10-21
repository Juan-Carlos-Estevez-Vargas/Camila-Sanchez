import { describe, expect, it } from "vitest";
import { AccessPolicy, DEFAULT_ROLE_PERMISSIONS } from "@/domain/permissions";
import type { Role } from "@/domain/types";
import { tourFor, tourTarget } from "./tourSteps";

const policyFor = (role: Role | null) =>
  role ? new AccessPolicy(role, DEFAULT_ROLE_PERMISSIONS[role]) : AccessPolicy.anonymous();

const ids = (pathname: string, role: Role | null, displayName?: string) =>
  tourFor({ pathname, loggedIn: role !== null, displayName, policy: policyFor(role) }).map((s) => s.id);

describe("recorrido del tutorial", () => {
  it("empieza con un saludo y termina en el botón que lo vuelve a abrir", () => {
    const steps = tourFor({ pathname: "/", loggedIn: true, displayName: "Camila", policy: policyFor("editor") });
    expect(steps[0]).toMatchObject({ id: "welcome", title: "¡Hola, Camila! 💖" });
    expect(steps[0]?.target).toBeUndefined();
    expect(steps.at(-1)?.target).toEqual([tourTarget("tour-launcher")]);
  });

  it("a quien visita sin cuenta le enseña la página y cómo entrar", () => {
    expect(ids("/", null)).toEqual(["welcome", "site", "music", "nav-entrar", "launcher"]);
    expect(ids("/entrar", null)).toEqual(["welcome", "login-form", "login-modes", "launcher"]);
  });

  it("muestra sólo las partes del menú que la cuenta puede usar", () => {
    const viewer = ids("/", "viewer");
    expect(viewer).toContain("nav-chat");
    expect(viewer).not.toContain("nav-panel");
    expect(viewer).not.toContain("nav-super");

    const editor = ids("/", "editor");
    expect(editor).toContain("nav-panel");
    expect(editor).not.toContain("nav-super");

    expect(ids("/", "super_admin")).toEqual(expect.arrayContaining(["nav-panel", "nav-super", "bell", "nav-cuenta"]));
  });

  it("no repite en el menú la sección en la que ya se está", () => {
    expect(ids("/chat", "viewer")).toEqual(expect.arrayContaining(["chat-thread", "chat-composer"]));
    expect(ids("/chat", "viewer")).not.toContain("nav-chat");
    expect(ids("/panel/fotos", "editor")).not.toContain("nav-panel");
    expect(ids("/cuenta", "viewer")).not.toContain("nav-cuenta");
  });

  it("explica la página concreta de cada panel", () => {
    const photos = tourFor({ pathname: "/panel/fotos", loggedIn: true, policy: policyFor("editor") });
    expect(photos.find((s) => s.id === "admin-page")?.title).toBe("Fotos");
    const users = tourFor({ pathname: "/super/usuarios/", loggedIn: true, policy: policyFor("super_admin") });
    expect(users.find((s) => s.id === "admin-page")?.title).toBe("Usuarios");
  });

  it("enseña las listas: el listado y cada lista por dentro", () => {
    expect(ids("/listas", "viewer")).toEqual(expect.arrayContaining(["lists-new", "lists-grid"]));
    expect(ids("/listas", "viewer")).not.toContain("nav-listas");
    expect(ids("/listas/123", "viewer")).toEqual(expect.arrayContaining(["list-add", "list-tasks", "list-settings"]));
    expect(ids("/", "viewer")).toContain("nav-listas");
  });

  it("en móvil, los enlaces del menú caen en el botón ☰", () => {
    const step = tourFor({ pathname: "/", loggedIn: true, policy: policyFor("viewer") }).find((s) => s.id === "nav-chat");
    expect(step?.target).toEqual([tourTarget("nav-chat"), tourTarget("menu")]);
    expect(step?.fallbackNote).toMatch(/menú ☰/);
  });

  it("todos los pasos tienen un id único y texto", () => {
    for (const path of ["/", "/entrar", "/mensajes", "/chat", "/cuenta", "/panel", "/super/auditoria", "/invitacion", "/recuperar", "/listas", "/listas/abc"]) {
      const steps = tourFor({ pathname: path, loggedIn: true, policy: policyFor("super_admin") });
      expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
      for (const s of steps) expect(s.title && s.body).toBeTruthy();
    }
  });
});
