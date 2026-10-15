/**
 * Orquesta la subida de fotos (patrón Facade): optimizar en un worker →
 * subir original optimizado y miniatura → guardar el registro. Usa la
 * TaskQueue para limitar la concurrencia y reintentar fallos de red.
 */
import type { Backend } from "@/data/ports";
import { toIsoDate } from "@/domain/dates";
import type { IsoDate, Photo } from "@/domain/types";
import { TaskQueue, type TaskSnapshot } from "@/services/queue/TaskQueue";
import { ImageProcessor } from "./ImageProcessor";

export interface UploadRequest {
  file: File;
  caption?: string;
  takenOn?: IsoDate;
}

export interface UploadResult {
  photo: Photo;
  originalBytes: number;
  finalBytes: number;
}

export type UploadSnapshot = TaskSnapshot<UploadResult>;

export class PhotoUploader {
  private readonly queue = new TaskQueue<UploadResult>({ concurrency: 2, retries: 2 });
  private readonly processor = new ImageProcessor();

  constructor(private readonly backend: Backend) {}

  subscribe(listener: (tasks: UploadSnapshot[]) => void): () => void {
    return this.queue.subscribe(listener);
  }

  enqueue(requests: UploadRequest[], basePosition: number): Promise<PromiseSettledResult<UploadResult>[]> {
    return Promise.allSettled(
      requests.map((request, index) =>
        this.queue.add(request.file.name, async ({ report, signal }) => {
          report(0.05, "Optimizando con cariño");
          const optimized = await this.processor.process(request.file);
          if (signal.aborted) throw new DOMException("Cancelado", "AbortError");

          report(0.45, "Guardando en nuestro álbum");
          const uploaded = await this.backend.photos.upload(optimized.full, optimized.thumb, optimized.extension);

          report(0.9, "Poniéndole un lacito");
          const photo = await this.backend.photos.save({
            storagePath: uploaded.storagePath,
            thumbPath: uploaded.thumbPath,
            externalUrl: null,
            caption: request.caption ?? "",
            takenOn: request.takenOn ?? toIsoDate(new Date(request.file.lastModified || Date.now())),
            position: basePosition + index,
            width: optimized.width,
            height: optimized.height,
            bytes: optimized.full.size,
          });
          return { photo, originalBytes: optimized.originalBytes, finalBytes: optimized.full.size };
        }),
      ),
    );
  }

  cancelAll(): void {
    this.queue.cancelAll();
  }

  clearFinished(): void {
    this.queue.clearFinished();
  }

  dispose(): void {
    this.queue.cancelAll();
    this.processor.dispose();
  }
}
