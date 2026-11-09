/**
 * Núcleo del optimizador de imágenes. Se ejecuta dentro de un Web Worker
 * (OffscreenCanvas) para no congelar la interfaz; si el navegador no tiene
 * OffscreenCanvas, el mismo código corre en el hilo principal con <canvas>.
 *
 * - Respeta la orientación EXIF y la descarta al re-codificar: así se borran
 *   metadatos privados como la ubicación GPS.
 * - Redimensiona con el remuestreo de alta calidad del navegador
 *   (`resizeQuality: "high"`) o, si no lo tiene, por pasos a la mitad.
 * - Le devuelve la nitidez que se pierde al achicar (unsharp mask suave,
 *   más fuerte cuanto más se redujo) sin realzar el ruido.
 * - Codifica en WebP (o JPEG si el navegador no sabe WebP) con la calidad
 *   más alta que cumpla el peso objetivo (búsqueda binaria).
 * - Si el original ya era más liviano y no trae metadatos, se queda con el
 *   original (nunca con uno que tenga EXIF: podría llevar la ubicación GPS).
 */
import { EXIF_SCAN_BYTES, hasExifMetadata } from "./exif";
import { downscaleSteps, fitWithin, nextQuality, sharpenAmount, THUMB_QUALITY, type ImageOptions } from "./sizing";

export interface OptimizedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: string;
  extension: string;
  originalBytes: number;
  /** Tamaño de la foto original (para avisar si tiene baja resolución). */
  sourceWidth: number;
  sourceHeight: number;
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

/** Pinta la imagen en un lienzo nuevo del tamaño dado, sobre fondo blanco (PNG con transparencia). */
function paint(factory: CanvasFactory, image: CanvasImageSource, width: number, height: number): AnyCanvas {
  const canvas = factory.create(width, height);
  const ctx = context(canvas);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

/**
 * Achica con el mejor método disponible: el remuestreo «high» del navegador
 * (Lanczos o similar, más nítido que el bilineal del canvas) y, si no existe,
 * la reducción por pasos.
 */
async function scale(factory: CanvasFactory, source: ImageBitmap, maxEdge: number): Promise<AnyCanvas> {
  const target = fitWithin(source.width, source.height, maxEdge);
  if (target.width === source.width && target.height === source.height) return paint(factory, source, target.width, target.height);
  try {
    const resized = await createImageBitmap(source, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: "high" });
    try {
      if (resized.width === target.width && resized.height === target.height) return paint(factory, resized, target.width, target.height);
    } finally {
      resized.close();
    }
  } catch {
    // Sin opciones de tamaño en createImageBitmap: se usa la reducción por pasos.
  }
  return resize(factory, source, maxEdge);
}

/**
 * Unsharp mask: suma la diferencia entre la foto y una versión desenfocada
 * (caja de 3×3). Las diferencias muy pequeñas (ruido, cielo liso) no se
 * tocan para no llenarlas de grano.
 */
export function sharpenPixels(data: Uint8ClampedArray, width: number, height: number, amount: number, threshold = 3): void {
  if (amount <= 0 || width < 3 || height < 3) return;
  const row = width * 4;
  const horizontal = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    const base = y * row;
    for (let x = 0; x < width; x++) {
      const i = base + x * 4;
      const left = x > 0 ? i - 4 : i;
      const right = x < width - 1 ? i + 4 : i;
      horizontal[i] = (data[left]! + data[i]! + data[right]!) / 3;
      horizontal[i + 1] = (data[left + 1]! + data[i + 1]! + data[right + 1]!) / 3;
      horizontal[i + 2] = (data[left + 2]! + data[i + 2]! + data[right + 2]!) / 3;
    }
  }
  for (let y = 0; y < height; y++) {
    const up = y > 0 ? -row : 0;
    const down = y < height - 1 ? row : 0;
    for (let x = 0; x < width; x++) {
      const i = y * row + x * 4;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const blurred = (horizontal[k + up]! + horizontal[k]! + horizontal[k + down]!) / 3;
        const diff = data[k]! - blurred;
        if (diff > threshold || diff < -threshold) data[k] = data[k]! + diff * amount;
      }
    }
  }
}

function sharpen(canvas: AnyCanvas, amount: number): void {
  if (amount <= 0) return;
  const ctx = context(canvas);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  sharpenPixels(image.data, canvas.width, canvas.height, amount);
  ctx.putImageData(image, 0, 0);
}

/** La calidad más alta (entre la mínima y la inicial) que cumpla el peso objetivo. */
async function encode(factory: CanvasFactory, canvas: AnyCanvas, mime: string, options: Pick<ImageOptions, "quality" | "minQuality" | "targetBytes">): Promise<Blob> {
  const first = await factory.toBlob(canvas, mime, options.quality);
  if (first.size <= options.targetBytes || options.minQuality >= options.quality) return first;
  let best = await factory.toBlob(canvas, mime, options.minQuality);
  // Ni con la mínima entra: mejor pasarse un poco que dañar la foto.
  if (best.size > options.targetBytes) return best;
  let low = options.minQuality;
  let high = options.quality;
  for (let q = nextQuality(low, high); q !== null; q = nextQuality(low, high)) {
    const blob = await factory.toBlob(canvas, mime, q);
    if (blob.size <= options.targetBytes) {
      best = blob;
      low = q;
    } else {
      high = q;
    }
  }
  return best;
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
    const sourceEdge = Math.max(bitmap.width, bitmap.height);
    const fullCanvas = await scale(factory, bitmap, options.maxEdge);
    sharpen(fullCanvas, sharpenAmount(sourceEdge, Math.max(fullCanvas.width, fullCanvas.height)));
    let full = await encode(factory, fullCanvas, mime, options);
    let finalMime = mime;
    let finalExt = extension;
    const fitsAlready = sourceEdge <= options.maxEdge;
    if (
      fitsAlready && file.size <= full.size && (file.type === "image/jpeg" || file.type === "image/webp") &&
      !hasExifMetadata(await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer())
    ) {
      // El original ya estaba optimizado: no lo empeoramos.
      full = file;
      finalMime = file.type;
      finalExt = file.type === "image/webp" ? "webp" : "jpg";
    }
    const thumbCanvas = await scale(factory, bitmap, options.thumbEdge);
    sharpen(thumbCanvas, sharpenAmount(sourceEdge, Math.max(thumbCanvas.width, thumbCanvas.height)));
    const thumb = await factory.toBlob(thumbCanvas, mime, THUMB_QUALITY);
    return {
      full, thumb, width: fullCanvas.width, height: fullCanvas.height,
      mime: finalMime, extension: finalExt, originalBytes: file.size,
      sourceWidth: bitmap.width, sourceHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
