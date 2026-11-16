import { describe, expect, it, vi } from "vitest";
import { markForYouOpened, postponeForYou, wasForYouOpened, wasForYouPostponed } from "./forYouSeen";

/** Storage mínimo en memoria (las pruebas corren en Node, sin navegador). */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("tarjeta «Tengo algo para ti»", () => {
  it("sale hasta que la carta se abre", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    expect(wasForYouOpened()).toBe(false);
    markForYouOpened();
    expect(wasForYouOpened()).toBe(true);
  });

  it("«Luego» la esconde sólo en esta visita", () => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    expect(wasForYouPostponed()).toBe(false);
    postponeForYou();
    expect(wasForYouPostponed()).toBe(true);
  });

  it("sin almacenamiento no falla: la tarjeta sigue saliendo", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } });
    expect(() => markForYouOpened()).not.toThrow();
    expect(wasForYouOpened()).toBe(false);
  });
});

describe("tarjeta «Tengo algo que decirte»", () => {
  it("la despedida lleva sus propias claves", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    markForYouOpened("forYou");
    expect(wasForYouOpened("goodbye")).toBe(false);
    markForYouOpened("goodbye");
    expect(wasForYouOpened("goodbye")).toBe(true);
  });
});
