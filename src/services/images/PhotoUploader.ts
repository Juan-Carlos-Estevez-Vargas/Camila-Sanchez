/**
 * Orquesta la subida de fotos (patrón Facade): huella y fecha → optimizar en
 * un worker → subir original optimizado y miniatura → guardar el registro.
 * Usa la TaskQueue para limitar la concurrencia y reintentar fallos de red,
 * así una tanda de cientos de fotos avanza de a pocas sin agotar la memoria.
 */
import type { Backend } from "@/data/ports";
import { toIsoDate } from "@/domain/dates";
import type { IsoDate, Photo } from "@/domain/types";
import { TaskQueue, type TaskSnapshot } from "@/services/queue/TaskQueue";
import { fingerprint } from "./bulk";
import { readCapturedDate } from "./exif";
import { ImageProcessor } from "./ImageProcessor";

export interface UploadRequest {
  file: File;
  caption?: string;
  /** Fecha fija; si falta se usa la de la cámara (EXIF) o la del archivo. */
  takenOn?: IsoDate;
}

export interface UploadOptions {
  basePosition: number;
  /** Huellas de las fotos que ya están en el álbum. */
  knownHashes?: ReadonlySet<string>;
  skipDuplicates?: boolean;
}

export type UploadResult =
  | { kind: "uploaded"; photo: Photo; originalBytes: number; finalBytes: number }
  | { kind: "duplicate" };

export type UploadSnapshot = TaskSnapshot<UploadResult>;

const abortIfNeeded = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
};

export class PhotoUploader {
  // 3 a la vez: mientras una foto se optimiza, otra sube y otra se guarda.
  private readonly queue = new TaskQueue<UploadResult>({ concurrency: 3, retries: 2 });
  private readonly processor = new ImageProcessor();

  constructor(private readonly backend: Backend) {}

  subscribe(listener: (tasks: UploadSnapshot[]) => void): () => void {
    return this.queue.subscribe(listener);
  }

  enqueue(requests: UploadRequest[], options: UploadOptions): Promise<PromiseSettledResult<UploadResult>[]> {
    // Huellas vistas en esta tanda o ya en el álbum; se marca antes de subir
    // para que dos copias de la misma foto en la tanda no suban ambas.
    const seen = new Set(options.knownHashes ?? []);
    const skip = options.skipDuplicates ?? true;

    return Promise.allSettled(
      requests.map((request, index) =>
        this.queue.add(request.file.name, async ({ report, signal }) => {
          report(0.02, "Revisando la foto");
          const hash = await fingerprint(request.file);
          if (hash && skip && seen.has(hash)) {
            report(1, "Ya estaba en el álbum");
            return { kind: "duplicate" } as const;
          }
          if (hash) seen.add(hash);

          try {
            const takenOn = request.takenOn
              ?? (await readCapturedDate(request.file))
              ?? toIsoDate(new Date(request.file.lastModified || Date.now()));
            abortIfNeeded(signal);

            report(0.08, "Optimizando con cariño");
            const optimized = await this.processor.process(request.file);
            abortIfNeeded(signal);

            report(0.45, "Guardando en nuestro álbum");
            const uploaded = await this.backend.photos.upload(optimized.full, optimized.thumb, optimized.extension);

            report(0.9, "Poniéndole un lacito");
            const photo = await this.backend.photos.save({
              storagePath: uploaded.storagePath,
              thumbPath: uploaded.thumbPath,
              externalUrl: null,
              caption: request.caption ?? "",
              takenOn,
              position: options.basePosition + index,
              width: optimized.width,
              height: optimized.height,
              bytes: optimized.full.size,
              sourceHash: hash,
            });
            return { kind: "uploaded", photo, originalBytes: optimized.originalBytes, finalBytes: optimized.full.size } as const;
          } catch (error) {
            // Si falla (o se reintenta), la huella no debe bloquear el siguiente intento.
            if (hash && !options.knownHashes?.has(hash)) seen.delete(hash);
            throw error;
          }
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
