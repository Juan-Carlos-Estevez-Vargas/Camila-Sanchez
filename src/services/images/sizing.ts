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

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  maxEdge: 2048,
  thumbEdge: 480,
  quality: 0.84,
  targetBytes: 450 * 1024,
  minQuality: 0.68,
};

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

/** Secuencia de calidades a probar hasta cumplir el peso objetivo. */
export function qualityLadder(options: ImageOptions): number[] {
  const ladder: number[] = [];
  for (let q = options.quality; q >= options.minQuality - 1e-9; q -= 0.06) ladder.push(Math.round(q * 100) / 100);
  return ladder.length ? ladder : [options.minQuality];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
