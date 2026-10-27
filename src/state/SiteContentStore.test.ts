import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Backend } from "@/data/ports";
import { SiteContentStore } from "./SiteContentStore";

/** Storage mínimo en memoria (las pruebas corren en Node, sin navegador). */
class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

vi.stubGlobal("localStorage", new MemoryStorage());
vi.stubGlobal("sessionStorage", new MemoryStorage());

function fakeBackend(siteTitle: string, fail = false): Backend {
  const settle = <T>(value: T) => (fail ? Promise.reject(new Error("sin conexión")) : Promise.resolve(value));
  return {
    content: {
      getSettings: () => settle({ siteTitle }),
      listSections: () => settle([]),
      listMilestones: () => settle([]),
      listDates: () => settle([]),
      listInterruptions: () => settle([]),
    },
    photos: { list: () => settle([]), resolveUrls: () => Promise.resolve(new Map()) },
  } as unknown as Backend;
}

const title = (store: SiteContentStore) => (store.getSnapshot().content?.settings as { siteTitle?: string } | undefined)?.siteTitle;

describe("caché del contenido del sitio", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("al volver a abrir pinta al instante lo último que se vio", async () => {
    await new SiteContentStore(fakeBackend("Nuestro rincón")).load("ana");
    const next = new SiteContentStore(fakeBackend("otro"));
    next.hydrate();
    expect(next.getSnapshot().status).toBe("ready");
    expect(title(next)).toBe("Nuestro rincón");
  });

  it("sin conexión sigue mostrando la copia guardada", async () => {
    await new SiteContentStore(fakeBackend("Guardado")).load("ana");
    const offline = new SiteContentStore(fakeBackend("x", true));
    offline.hydrate();
    await offline.load("ana");
    expect(offline.getSnapshot().status).toBe("ready");
    expect(title(offline)).toBe("Guardado");
  });

  it("con otra cuenta (o sin sesión) no muestra lo privado de la anterior", async () => {
    await new SiteContentStore(fakeBackend("Privado")).load("ana");
    const store = new SiteContentStore(fakeBackend("Público", true));
    store.hydrate();
    await store.load(null);
    expect(store.getSnapshot().status).toBe("error");
    expect(store.getSnapshot().content).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("sin nada guardado arranca cargando", () => {
    const store = new SiteContentStore(fakeBackend("x"));
    store.hydrate();
    expect(store.getSnapshot().status).toBe("loading");
  });
});
