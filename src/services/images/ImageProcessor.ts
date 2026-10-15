/**
 * Pool de Web Workers para optimizar imágenes en paralelo sin bloquear la
 * interfaz. El tamaño del pool se adapta a los núcleos del dispositivo (máx.
 * 3, para no agotar la memoria de un teléfono). Si el navegador no soporta
 * OffscreenCanvas en workers, cae al hilo principal (patrón Strategy).
 */
import { AppError } from "@/core/errors";
import { domCanvasFactory, optimizeImage, type OptimizedImage } from "./optimize";
import { DEFAULT_IMAGE_OPTIONS, type ImageOptions } from "./sizing";
import type { WorkerRequest, WorkerResponse } from "./image.worker";

const MAX_INPUT_BYTES = 40 * 1024 * 1024;

interface Pending {
  resolve: (r: OptimizedImage) => void;
  reject: (e: unknown) => void;
}

interface Job {
  request: WorkerRequest;
  pending: Pending;
}

const friendly = (message: string) =>
  message === "UNSUPPORTED_FORMAT"
    ? new AppError("No pude abrir esta imagen. Prueba con una foto JPG, PNG o WebP.")
    : new AppError("No pude optimizar esta imagen.");

export class ImageProcessor {
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly backlog: Job[] = [];
  private readonly inflight = new Map<number, Pending>();
  private seq = 0;
  private readonly useWorkers: boolean;

  constructor(private readonly options: ImageOptions = DEFAULT_IMAGE_OPTIONS) {
    this.useWorkers =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      "convertToBlob" in OffscreenCanvas.prototype;
  }

  private get poolSize(): number {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    return Math.max(1, Math.min(3, cores - 1));
  }

  async process(file: File | Blob): Promise<OptimizedImage> {
    if (file.type && !file.type.startsWith("image/")) throw new AppError("Ese archivo no es una imagen.");
    if (file.size > MAX_INPUT_BYTES) throw new AppError("La imagen pesa más de 40 MB.");
    if (!this.useWorkers) {
      try {
        return await optimizeImage(file, this.options, domCanvasFactory);
      } catch (error) {
        throw friendly(error instanceof Error ? error.message : "");
      }
    }
    return new Promise<OptimizedImage>((resolve, reject) => {
      this.backlog.push({ request: { id: ++this.seq, file, options: this.options }, pending: { resolve, reject } });
      this.dispatch();
    });
  }

  private spawn(): Worker {
    const worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const pending = this.inflight.get(data.id);
      this.inflight.delete(data.id);
      this.idle.push(worker);
      if (data.ok) pending?.resolve(data.result);
      else pending?.reject(friendly(data.error));
      this.dispatch();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      // Un worker roto se reemplaza; las tareas que tenía fallan con mensaje claro.
      this.inflight.forEach((p) => p.reject(new AppError("El optimizador de imágenes se detuvo. Inténtalo otra vez.")));
      this.inflight.clear();
      worker.terminate();
      this.workers.splice(this.workers.indexOf(worker), 1);
      this.dispatch();
    };
    this.workers.push(worker);
    return worker;
  }

  private dispatch(): void {
    while (this.backlog.length) {
      const worker = this.idle.pop() ?? (this.workers.length < this.poolSize ? this.spawn() : null);
      if (!worker) return;
      const job = this.backlog.shift()!;
      this.inflight.set(job.request.id, job.pending);
      worker.postMessage(job.request);
    }
  }

  /** Libera los workers (p. ej. al salir del panel). */
  dispose(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers.length = 0;
    this.idle.length = 0;
  }
}
