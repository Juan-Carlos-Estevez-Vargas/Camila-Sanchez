/**
 * Núcleo del optimizador de imágenes. Se ejecuta dentro de un Web Worker
 * (OffscreenCanvas) para no congelar la interfaz; si el navegador no tiene
 * OffscreenCanvas, el mismo código corre en el hilo principal con <canvas>.
 *
 * - Respeta la orientación EXIF y la descarta al re-codificar: así se borran
 *   metadatos privados como la ubicación GPS.
 * - Redimensiona por pasos para conservar nitidez.
 * - Codifica en WebP (o JPEG si el navegador no sabe WebP) bajando la calidad
 *   poco a poco sólo hasta alcanzar el peso objetivo.
 * - Si el original ya era más liviano, se queda con el original.
 */
import { downscaleSteps, fitWithin, qualityLadder, type ImageOptions } from "./sizing";

export interface OptimizedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: string;
  extension: string;
  originalBytes: number;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface CanvasFactory {
  create(width: number, height: number): AnyCanvas;
  toBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob>;
}

export const offscreenFactory: CanvasFactory = {
  create: (w, h) => new OffscreenCanvas(w, h),
  toBlob: (canvas, type, quality) => (canvas as OffscreenCanvas).convertToBlob({ type, quality }),
};

export const domCanvasFactory: CanvasFactory = {
  create(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  },
  toBlob: (canvas, type, quality) =>
    new Promise((resolve, reject) =>
      (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar"))), type, quality),
    ),
};

function context(canvas: AnyCanvas): Ctx2D {
  const ctx = canvas.getContext("2d", { alpha: false }) as Ctx2D | null;
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function resize(factory: CanvasFactory, source: ImageBitmap, maxEdge: number): AnyCanvas {
  const target = fitWithin(source.width, source.height, maxEdge);
  const longest = Math.max(source.width, source.height);
  const steps = downscaleSteps(longest, Math.max(target.width, target.height));
  let current: CanvasImageSource = source;
  let currentW = source.width;
  let currentH = source.height;
  let canvas: AnyCanvas | null = null;
  for (const edge of steps) {
    const size = fitWithin(currentW, currentH, edge);
    canvas = factory.create(size.width, size.height);
    const ctx = context(canvas);
    ctx.fillStyle = "#fff"; // fondo para PNG con transparencia
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(current, 0, 0, size.width, size.height);
    current = canvas;
    currentW = size.width;
    currentH = size.height;
  }
  return canvas!;
}

async function encode(factory: CanvasFactory, canvas: AnyCanvas, mime: string, ladder: number[], targetBytes: number) {
  let best: Blob | null = null;
  for (const quality of ladder) {
    const blob = await factory.toBlob(canvas, mime, quality);
    best = blob;
    if (blob.size <= targetBytes) break;
  }
  return best!;
}

let webpSupport: boolean | null = null;

async function pickMime(factory: CanvasFactory): Promise<{ mime: string; extension: string }> {
  if (webpSupport === null) {
    try {
      const probe = await factory.toBlob(factory.create(2, 2), "image/webp", 0.8);
      webpSupport = probe.type === "image/webp";
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport ? { mime: "image/webp", extension: "webp" } : { mime: "image/jpeg", extension: "jpg" };
}

export async function optimizeImage(file: Blob, options: ImageOptions, factory: CanvasFactory): Promise<OptimizedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    throw new Error("UNSUPPORTED_FORMAT", { cause: error });
  }
  try {
    const { mime, extension } = await pickMime(factory);
    const fullCanvas = resize(factory, bitmap, options.maxEdge);
    let full = await encode(factory, fullCanvas, mime, qualityLadder(options), options.targetBytes);
    let finalMime = mime;
    let finalExt = extension;
    const fitsAlready = Math.max(bitmap.width, bitmap.height) <= options.maxEdge;
    if (fitsAlready && file.size <= full.size && (file.type === "image/jpeg" || file.type === "image/webp")) {
      // El original ya estaba optimizado: no lo empeoramos.
      full = file;
      finalMime = file.type;
      finalExt = file.type === "image/webp" ? "webp" : "jpg";
    }
    const thumbCanvas = resize(factory, bitmap, options.thumbEdge);
    const thumb = await encode(factory, thumbCanvas, mime, [0.78], Number.POSITIVE_INFINITY);
    return {
      full, thumb, width: fullCanvas.width, height: fullCanvas.height,
      mime: finalMime, extension: finalExt, originalBytes: file.size,
    };
  } finally {
    bitmap.close();
  }
}
