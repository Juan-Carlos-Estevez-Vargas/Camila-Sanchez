/**
 * Store del contenido del sitio (patrón Observable + caché). Carga todo en
 * paralelo una vez, se mantiene al día con Realtime y sólo recarga la
 * colección que cambió (con debounce para agrupar ráfagas de cambios).
 *
 * La última versión se guarda en el navegador: al abrir la app se pinta al
 * instante y luego se actualiza con lo que diga el servidor.
 */
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { clearPrivateCaches, readCache, writeCache } from "@/data/localCache";
import type { Backend, RealtimeTable } from "@/data/ports";
import type { PhotoUrls, SiteContent, Uuid } from "@/domain/types";
import { useBackend } from "./BackendContext";
import { useAuth } from "./AuthContext";

export type ContentKey = keyof SiteContent;

/** Dueño del contenido guardado: el id de la cuenta o null sin sesión. */
type Owner = Uuid | null;
interface CachedContent {
  owner: Owner;
  content: SiteContent;
}
const CONTENT_CACHE = "site-content";

export interface SiteContentState {
  status: "loading" | "ready" | "error";
  content: SiteContent | null;
  photoUrls: Map<Uuid, PhotoUrls>;
  error: unknown;
}

const TABLE_TO_KEY: Partial<Record<RealtimeTable, ContentKey>> = {
  site_settings: "settings",
  sections: "sections",
  photos: "photos",
  milestones: "milestones",
  important_dates: "dates",
  interruptions: "interruptions",
};

export class SiteContentStore {
  private state: SiteContentState = { status: "loading", content: null, photoUrls: new Map(), error: null };
  private readonly listeners = new Set<() => void>();
  private pending = new Set<ContentKey>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  private generation = 0;
  /** De quién es lo que hay en pantalla (puede venir de la caché). */
  private owner: Owner | undefined;

  constructor(private readonly backend: Backend) {}

  /**
   * Pinta al instante lo último que se vio en este dispositivo, mientras se
   * confirma la sesión y llegan los datos frescos.
   */
  hydrate(): void {
    const cached = readCache<CachedContent>(CONTENT_CACHE);
    if (!cached?.content || this.state.content) return;
    this.owner = cached.owner;
    this.set({ status: "ready", content: cached.content, error: null });
    void this.resolvePhotoUrls(this.generation).catch(() => undefined);
  }

  private save() {
    if (this.state.content && this.owner !== undefined) {
      writeCache(CONTENT_CACHE, { owner: this.owner, content: this.state.content } satisfies CachedContent);
    }
  }

  getSnapshot = (): SiteContentState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<SiteContentState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private loaders(): { [K in ContentKey]: () => Promise<SiteContent[K]> } {
    const { content, photos } = this.backend;
    return {
      settings: () => content.getSettings(),
      sections: () => content.listSections(),
      photos: () => photos.list(),
      milestones: () => content.listMilestones(),
      dates: () => content.listDates(),
      interruptions: () => content.listInterruptions("active"),
    };
  }

  /** Carga completa (al arrancar o al cambiar de sesión). */
  async load(owner: Owner = this.owner ?? null): Promise<void> {
    const generation = ++this.generation;
    if (this.owner !== undefined && this.owner !== owner) {
      // Otra cuenta (o se cerró la sesión): lo de antes no se muestra ni se guarda.
      if (this.owner !== null) void clearPrivateCaches();
      this.set({ status: "loading", content: null, photoUrls: new Map(), error: null });
    }
    this.owner = owner;
    const l = this.loaders();
    try {
      const [settings, sections, photos, milestones, dates, interruptions] = await Promise.all([
        l.settings(), l.sections(), l.photos(), l.milestones(), l.dates(), l.interruptions(),
      ]);
      if (generation !== this.generation) return;
      const content: SiteContent = { settings, sections, photos, milestones, dates, interruptions };
      this.set({ status: "ready", content, error: null });
      this.save();
      await this.resolvePhotoUrls(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      // Sin conexión pero con algo guardado: se sigue mostrando lo guardado.
      if (this.state.content) console.warn("[content] usando la copia guardada", error);
      else this.set({ status: "error", error });
    }
  }

  private async resolvePhotoUrls(generation: number) {
    const photos = this.state.content?.photos ?? [];
    const urls = await this.backend.photos.resolveUrls(photos);
    if (generation === this.generation) this.set({ photoUrls: urls });
  }

  /** Pide recargar una colección; se agrupan en una sola ronda. */
  refresh(...keys: ContentKey[]): void {
    keys.forEach((k) => this.pending.add(k));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 250);
  }

  private async flush() {
    const keys = [...this.pending];
    this.pending.clear();
    this.timer = null;
    if (!this.state.content) return this.load();
    const generation = this.generation;
    const l = this.loaders();
    try {
      const entries = await Promise.all(keys.map(async (k) => [k, await l[k]()] as const));
      if (generation !== this.generation || !this.state.content) return;
      const content = { ...this.state.content } as Record<ContentKey, unknown>;
      for (const [k, v] of entries) content[k] = v;
      this.set({ content: content as unknown as SiteContent });
      this.save();
      if (keys.includes("photos")) await this.resolvePhotoUrls(generation);
    } catch (error) {
      console.error("[content] no se pudo refrescar", error);
    }
  }

  connectRealtime(): void {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.backend.realtime.subscribe(
      Object.keys(TABLE_TO_KEY) as RealtimeTable[],
      (change) => {
        const key = TABLE_TO_KEY[change.table];
        if (key) this.refresh(key);
      },
    );
  }

  dispose(): void {
    this.unsubscribeRealtime?.();
    if (this.timer) clearTimeout(this.timer);
  }
}

const StoreContext = createContext<SiteContentStore | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { user, loading } = useAuth();
  const store = useMemo(() => {
    const s = new SiteContentStore(backend);
    s.hydrate();
    return s;
  }, [backend]);

  useEffect(() => {
    store.connectRealtime();
    return () => store.dispose();
  }, [store]);

  // Lo visible depende de la sesión (sitio privado, secciones ocultas...).
  useEffect(() => {
    if (!loading) void store.load(user?.id ?? null);
  }, [store, user?.id, loading]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useContentStore(): SiteContentStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useContentStore debe usarse dentro de <SiteContentProvider>");
  return store;
}

export function useSiteContent(): SiteContentState {
  const store = useContentStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
