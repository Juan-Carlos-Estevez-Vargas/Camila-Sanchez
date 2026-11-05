/** Cuentas de la paginación (base 0), sin React para poder probarlas solas. */

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Números de página a mostrar (base 0) con "…" donde se saltan páginas.
 * Siempre incluye la primera, la última y `around` páginas a cada lado de la
 * actual: 1 … 4 5 [6] 7 8 … 20.
 */
export function pageItems(current: number, pages: number, around = 1): (number | "…")[] {
  const keep = new Set<number>([0, pages - 1]);
  for (let p = current - around; p <= current + around; p++) if (p >= 0 && p < pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  let prev: number | undefined;
  for (const p of sorted) {
    if (prev !== undefined && p - prev === 2) items.push(prev + 1); // un solo hueco: mejor el número que "…"
    else if (prev !== undefined && p - prev > 2) items.push("…");
    items.push(p);
    prev = p;
  }
  return items;
}
