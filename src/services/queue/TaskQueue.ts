/**
 * Cola de tareas con concurrencia limitada, reintentos con backoff
 * exponencial y cancelación. La usamos para las subidas de fotos: así diez
 * fotos no saturan la red ni la memoria del teléfono, y un corte de red
 * momentáneo no hace fallar la subida.
 */
export type TaskStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface TaskSnapshot<R> {
  id: string;
  label: string;
  status: TaskStatus;
  attempts: number;
  /** 0..1 reportado por la propia tarea. */
  progress: number;
  /** Texto libre de la etapa actual ("optimizando", "subiendo"...). */
  stage: string;
  result?: R;
  error?: unknown;
}

export interface TaskContext {
  signal: AbortSignal;
  report(progress: number, stage?: string): void;
}

export type TaskFn<R> = (ctx: TaskContext) => Promise<R>;

export interface TaskQueueOptions {
  concurrency?: number;
  retries?: number;
  baseDelayMs?: number;
  /** Decide si un error merece reintento (por defecto: errores de red). */
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const defaultSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelado", "AbortError"));
    }, { once: true });
  });

const isTransient = (error: unknown) =>
  error instanceof Error && /fetch|network|timeout|50\d|429|ECONNRESET/i.test(error.message);

interface Entry<R> {
  snapshot: TaskSnapshot<R>;
  run: TaskFn<R>;
  controller: AbortController;
  resolve: (value: R) => void;
  reject: (reason: unknown) => void;
}

export class TaskQueue<R = unknown> {
  private readonly entries: Entry<R>[] = [];
  private readonly listeners = new Set<(tasks: TaskSnapshot<R>[]) => void>();
  private running = 0;
  private seq = 0;
  private readonly concurrency: number;
  private readonly retries: number;
  private readonly baseDelayMs: number;
  private readonly shouldRetry: (error: unknown) => boolean;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;

  constructor(options: TaskQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.retries = Math.max(0, options.retries ?? 2);
    this.baseDelayMs = options.baseDelayMs ?? 800;
    this.shouldRetry = options.shouldRetry ?? isTransient;
    this.sleep = options.sleep ?? defaultSleep;
  }

  add(label: string, run: TaskFn<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.entries.push({
        snapshot: { id: `t${++this.seq}`, label, status: "queued", attempts: 0, progress: 0, stage: "En espera" },
        run, controller: new AbortController(), resolve, reject,
      });
      this.emit();
      this.pump();
    });
  }

  cancel(id: string): void {
    const entry = this.entries.find((e) => e.snapshot.id === id);
    if (!entry || ["done", "error", "cancelled"].includes(entry.snapshot.status)) return;
    entry.controller.abort();
    if (entry.snapshot.status === "queued") this.finish(entry, "cancelled", new DOMException("Cancelado", "AbortError"));
  }

  cancelAll(): void {
    this.entries.forEach((e) => this.cancel(e.snapshot.id));
  }

  /** Quita de la lista las tareas terminadas. */
  clearFinished(): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (["done", "error", "cancelled"].includes(this.entries[i]!.snapshot.status)) this.entries.splice(i, 1);
    }
    this.emit();
  }

  get snapshot(): TaskSnapshot<R>[] {
    return this.entries.map((e) => ({ ...e.snapshot }));
  }

  subscribe(listener: (tasks: TaskSnapshot<R>[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Espera a que no quede nada pendiente. */
  async drain(): Promise<void> {
    await Promise.allSettled(
      this.entries.map((e) => new Promise<void>((res) => {
        if (["done", "error", "cancelled"].includes(e.snapshot.status)) return res();
        const off = this.subscribe(() => {
          if (["done", "error", "cancelled"].includes(e.snapshot.status)) {
            off();
            res();
          }
        });
      })),
    );
  }

  private emit(): void {
    const snap = this.snapshot;
    this.listeners.forEach((l) => l(snap));
  }

  private pump(): void {
    while (this.running < this.concurrency) {
      const next = this.entries.find((e) => e.snapshot.status === "queued");
      if (!next) return;
      void this.execute(next);
    }
  }

  private async execute(entry: Entry<R>): Promise<void> {
    this.running++;
    const { snapshot, controller } = entry;
    snapshot.status = "running";
    this.emit();
    const ctx: TaskContext = {
      signal: controller.signal,
      report: (progress, stage) => {
        snapshot.progress = Math.min(1, Math.max(0, progress));
        if (stage) snapshot.stage = stage;
        this.emit();
      },
    };
    try {
      for (;;) {
        snapshot.attempts++;
        try {
          const result = await entry.run(ctx);
          snapshot.result = result;
          snapshot.progress = 1;
          this.finish(entry, "done", undefined, result);
          break;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (snapshot.attempts > this.retries || !this.shouldRetry(error)) throw error;
          snapshot.stage = `Reintentando (${snapshot.attempts}/${this.retries})`;
          this.emit();
          await this.sleep(this.baseDelayMs * 2 ** (snapshot.attempts - 1), controller.signal);
        }
      }
    } catch (error) {
      this.finish(entry, controller.signal.aborted ? "cancelled" : "error", error);
    } finally {
      this.running--;
      this.pump();
    }
  }

  private finish(entry: Entry<R>, status: TaskStatus, error?: unknown, result?: R): void {
    entry.snapshot.status = status;
    if (status === "done") {
      entry.snapshot.stage = "Listo";
      entry.resolve(result as R);
    } else {
      entry.snapshot.error = error;
      entry.snapshot.stage = status === "cancelled" ? "Cancelado" : "Error";
      entry.reject(error);
    }
    this.emit();
  }
}
