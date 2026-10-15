/**
 * Bus de eventos tipado (patrón Observer). Desacopla a quien produce un
 * evento (p. ej. la capa realtime) de quien reacciona (toasts, contadores).
 */
export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        (listener as Listener<Events[K]>)(payload);
      } catch (error) {
        console.error(`[events] listener de "${String(event)}" falló`, error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}
