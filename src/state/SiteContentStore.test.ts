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
    photos: { list: () => settle([]), resolveUrls: () => Promise.resolve(new Map()), cachedUrls: () => new Map() },
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

  it("pinta las fotos con las URLs guardadas sin esperar a que se firmen", async () => {
    const photo = { id: "f1", storagePath: "2026-01/f1.webp", thumbPath: "2026-01/f1.thumb.webp", externalUrl: null };
    const cachedUrl = { full: "vieja-full", thumb: "vieja-thumb" };
    let sign: (urls: Map<string, { full: string; thumb: string }>) => void = () => undefined;
    const backend = {
      content: {
        getSettings: () => Promise.resolve({ siteTitle: "x" }),
        listSections: () => Promise.resolve([]),
        listMilestones: () => Promise.resolve([]),
        listDates: () => Promise.resolve([]),
        listInterruptions: () => Promise.resolve([]),
      },
      photos: {
        list: () => Promise.resolve([photo]),
        cachedUrls: () => new Map([["f1", cachedUrl]]),
        resolveUrls: () => new Promise((resolve) => (sign = resolve)),
      },
    } as unknown as Backend;
    const store = new SiteContentStore(backend);
    const loading = store.load("ana");
    await vi.waitFor(() => expect(store.getSnapshot().photoUrls.get("f1")).toEqual(cachedUrl));
    sign(new Map([["f1", { full: "nueva-full", thumb: "nueva-thumb" }]]));
    await loading;
    expect(store.getSnapshot().photoUrls.get("f1")?.thumb).toBe("nueva-thumb");
  });

  it("ordenar fotos se ve al instante y los clics seguidos no hacen saltar la lista", async () => {
    const photo = (id: string, position: number) => ({ id, position, takenOn: "2026-01-01", storagePath: null, thumbPath: null, externalUrl: `/${id}.jpg` });
    let server = [photo("a", 0), photo("b", 1), photo("c", 2)];
    const saves: Array<() => void> = [];
    const lists = vi.fn(() => Promise.resolve(server.map((p) => ({ ...p }))));
    const backend = {
      content: {
        getSettings: () => Promise.resolve({ siteTitle: "x" }),
        listSections: () => Promise.resolve([]),
        listMilestones: () => Promise.resolve([]),
        listDates: () => Promise.resolve([]),
        listInterruptions: () => Promise.resolve([]),
        reorder: (_table: string, ids: string[]) => new Promise<void>((resolve) => saves.push(() => {
          server = server.map((p) => ({ ...p, position: ids.indexOf(p.id) }));
          resolve();
        })),
      },
      photos: { list: lists, cachedUrls: () => new Map(), resolveUrls: () => Promise.resolve(new Map()) },
    } as unknown as Backend;
    const store = new SiteContentStore(backend);
    await store.load("ana");
    const order = () => [...store.getSnapshot().content!.photos].sort((x, y) => x.position - y.position).map((p) => p.id).join("");

    const first = store.reorderPhotos(["b", "a", "c"]);
    expect(order()).toBe("bac");
    const second = store.reorderPhotos(["b", "c", "a"]);
    expect(order()).toBe("bca");
    // Llega un aviso en tiempo real a mitad: no debe volver al orden viejo.
    store.refresh("photos");
    await vi.waitFor(() => expect(saves.length).toBe(1));
    saves.shift()!();
    await first;
    await new Promise((r) => setTimeout(r, 300));
    expect(order()).toBe("bca");
    await vi.waitFor(() => expect(saves.length).toBe(1));
    saves.shift()!();
    await second;
    await vi.waitFor(() => expect(lists).toHaveBeenCalledTimes(2));
    expect(order()).toBe("bca");
  });
});
