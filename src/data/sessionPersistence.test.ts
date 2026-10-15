import { beforeEach, describe, expect, it, vi } from "vitest";
import { remembersSession, sessionAwareStorage, setRememberSession } from "./sessionPersistence";

/** Storage mínimo en memoria (las pruebas corren en Node, sin navegador). */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

vi.stubGlobal("localStorage", new MemoryStorage());
vi.stubGlobal("sessionStorage", new MemoryStorage());

describe("persistencia de la sesión", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("por defecto recuerda la sesión en localStorage", () => {
    expect(remembersSession()).toBe(true);
    sessionAwareStorage.setItem("sb-token", "abc");
    expect(localStorage.getItem("sb-token")).toBe("abc");
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });

  it("sin 'recordarme' la guarda sólo en la pestaña y borra la persistente", () => {
    localStorage.setItem("sb-token", "viejo");
    setRememberSession(false);
    sessionAwareStorage.setItem("sb-token", "nuevo");
    expect(sessionStorage.getItem("sb-token")).toBe("nuevo");
    expect(localStorage.getItem("sb-token")).toBeNull();
    expect(sessionAwareStorage.getItem("sb-token")).toBe("nuevo");
  });

  it("al cerrar sesión borra ambas copias", () => {
    localStorage.setItem("k", "1");
    sessionStorage.setItem("k", "2");
    sessionAwareStorage.removeItem("k");
    expect(sessionAwareStorage.getItem("k")).toBeNull();
  });
});
