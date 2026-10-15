/**
 * Geometría del tutorial: dónde va el resaltado y dónde la tarjeta.
 * Pura (recibe rectángulos y medidas), para poder probarla sin navegador.
 */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export type Placement = "below" | "above" | "center" | "sheet";

export interface PopoverPosition {
  placement: Placement;
  top: number;
  left: number;
}

/** Aire alrededor del elemento resaltado. */
export const SPOT_PADDING = 8;
/** Separación entre el resaltado y la tarjeta. */
const GAP = 12;
/** Margen mínimo con el borde de la pantalla. */
const EDGE = 12;
/** Por debajo de este ancho la tarjeta se ancla abajo, como una hoja. */
export const SHEET_BELOW = 520;

/** Rectángulo del resaltado, recortado a la pantalla. */
export function spotlightBox(target: Box, viewport: Viewport, padding = SPOT_PADDING): Box {
  const top = Math.max(target.top - padding, 0);
  const left = Math.max(target.left - padding, 0);
  const bottom = Math.min(target.top + target.height + padding, viewport.height);
  const right = Math.min(target.left + target.width + padding, viewport.width);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

/**
 * Posición de la tarjeta: debajo del resaltado si cabe, si no encima; en
 * pantallas angostas, anclada abajo (y arriba si el resaltado está abajo).
 */
export function placePopover(spot: Box | null, popover: { width: number; height: number }, viewport: Viewport): PopoverPosition {
  const centered = {
    top: Math.max((viewport.height - popover.height) / 2, EDGE),
    left: Math.max((viewport.width - popover.width) / 2, EDGE),
  };
  if (!spot) return { placement: "center", ...centered };

  if (viewport.width < SHEET_BELOW) {
    const spotCenter = spot.top + spot.height / 2;
    const top = spotCenter > viewport.height / 2 ? EDGE : viewport.height - popover.height - EDGE;
    return { placement: "sheet", top: Math.max(top, EDGE), left: EDGE };
  }

  const left = clamp(spot.left + spot.width / 2 - popover.width / 2, EDGE, viewport.width - popover.width - EDGE);
  const below = spot.top + spot.height + GAP;
  if (below + popover.height <= viewport.height - EDGE) return { placement: "below", top: below, left };
  const above = spot.top - GAP - popover.height;
  if (above >= EDGE) return { placement: "above", top: above, left };
  // El resaltado ocupa casi toda la pantalla: la tarjeta va encima de él, abajo.
  return { placement: "below", top: Math.max(viewport.height - popover.height - EDGE, EDGE), left };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
