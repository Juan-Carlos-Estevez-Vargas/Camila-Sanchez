/** Cálculos puros del redimensionado (probados sin navegador). */

export interface ImageOptions {
  /** Lado mayor máximo de la imagen grande. */
  maxEdge: number;
  /** Lado mayor de la miniatura. */
  thumbEdge: number;
  /** Calidad inicial (0..1). */
  quality: number;
  /** Peso objetivo: si se supera se baja la calidad gradualmente. */
  targetBytes: number;
  /** Calidad mínima aceptable para no "dañar" la foto. */
  minQuality: number;
}

/**
 * Álbum de la página: fotos grandes y nítidas para verlas en pantalla
 * completa (también en pantallas retina). Las miniaturas de 640 px se ven
 * bien en las cuadrículas aunque la pantalla tenga el doble de densidad.
 */
export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  maxEdge: 2560,
  thumbEdge: 640,
  quality: 0.92,
  targetBytes: 1200 * 1024,
  minQuality: 0.8,
};

/** Fotos del chat, las listas y las dedicatorias: se ven en el celular. */
export const SHARED_IMAGE_OPTIONS: ImageOptions = {
  maxEdge: 2048,
  thumbEdge: 640,
  quality: 0.9,
  targetBytes: 700 * 1024,
  minQuality: 0.78,
};

/** Foto de perfil: pequeña, pero nítida en el círculo. */
export const AVATAR_IMAGE_OPTIONS: ImageOptions = {
  maxEdge: 640,
  thumbEdge: 192,
  quality: 0.9,
  targetBytes: 160 * 1024,
  minQuality: 0.78,
};

/** Calidad de las miniaturas (se ven pequeñas: un poco menos no se nota). */
export const THUMB_QUALITY = 0.85;

/**
 * Lado mayor por debajo del cual una foto se ve borrosa en grande (por
 * ejemplo, una que llegó comprimida por WhatsApp). La app la sube igual pero
 * avisa para que se pueda cambiar por una mejor.
 */
export const LOW_RESOLUTION_EDGE = 1200;

export function isLowResolution(width: number | null | undefined, height: number | null | undefined, maxEdge = LOW_RESOLUTION_EDGE): boolean {
  if (!width || !height) return false;
  return Math.max(width, height) < Math.min(LOW_RESOLUTION_EDGE, maxEdge);
}

/**
 * Nitidez que se le devuelve a una foto según cuánto se achicó: al reducir
 * se pierde detalle fino, y un toque de enfoque (unsharp mask) lo recupera.
 * Sin reducción (o casi) no se toca.
 */
export function sharpenAmount(sourceEdge: number, targetEdge: number): number {
  if (targetEdge <= 0 || sourceEdge <= targetEdge * 1.15) return 0;
  const ratio = sourceEdge / targetEdge;
  return Math.min(0.5, 0.2 + 0.1 * Math.log2(ratio));
}

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Pasos de reducción a la mitad antes del tamaño final. Reducir de golpe una
 * foto de 4000px a 480px produce bordes dentados; ir a la mitad cada vez
 * conserva la nitidez (técnica de "step-down").
 */
export function downscaleSteps(from: number, to: number): number[] {
  const steps: number[] = [];
  let current = from;
  while (current / 2 >= to * 1.5) {
    current = Math.round(current / 2);
    steps.push(current);
  }
  steps.push(to);
  return steps;
}

/**
 * Siguiente calidad a probar (búsqueda binaria): se queda con la más alta que
 * cumpla el peso objetivo en vez de bajar de a saltos fijos. Devuelve `null`
 * cuando ya no vale la pena seguir (diferencia menor a 0,02).
 */
export function nextQuality(low: number, high: number): number | null {
  if (high - low < 0.02) return null;
  return Math.round(((low + high) / 2) * 100) / 100;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
