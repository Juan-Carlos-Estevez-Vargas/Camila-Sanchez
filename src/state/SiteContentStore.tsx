/**
 * Store del contenido del sitio (patrón Observable + caché). Carga todo en
 * paralelo una vez, se mantiene al día con Realtime y sólo recarga la
 * colección que cambió (con debounce para agrupar ráfagas de cambios).
 */
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Backend, RealtimeTable } from "@/data/ports";
import type { PhotoUrls, SiteContent, Uuid } from "@/domain/types";
import { useBackend } from "./BackendContext";
import { useAuth } from "./AuthContext";

export type ContentKey = keyof SiteContent;

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

  constructor(private readonly backend: Backend) {}

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
  async load(): Promise<void> {
    const generation = ++this.generation;
    const l = this.loaders();
    try {
      const [settings, sections, photos, milestones, dates, interruptions] = await Promise.all([
        l.settings(), l.sections(), l.photos(), l.milestones(), l.dates(), l.interruptions(),
      ]);
      if (generation !== this.generation) return;
      const content: SiteContent = { settings, sections, photos, milestones, dates, interruptions };
      this.set({ status: "ready", content, error: null });
      await this.resolvePhotoUrls(generation);
    } catch (error) {
      if (generation === this.generation) this.set({ status: "error", error });
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
  const store = useMemo(() => new SiteContentStore(backend), [backend]);

  useEffect(() => {
    store.connectRealtime();
    return () => store.dispose();
  }, [store]);

  // Lo visible depende de la sesión (sitio privado, secciones ocultas...).
  useEffect(() => {
    if (!loading) void store.load();
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
