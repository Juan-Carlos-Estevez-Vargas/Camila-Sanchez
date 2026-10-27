import type { KeyboardEvent } from "react";

const KEYS: Record<string, "prev" | "next" | "first" | "last"> = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  Home: "first",
  End: "last",
};

/**
 * Teclado de pestañas y grupos de opciones (patrones ARIA "tabs" y
 * "radiogroup"): con las flechas, Inicio y Fin se pasa de una opción a otra
 * y se elige al instante. Se usa como onKeyDown del contenedor; las opciones
 * llevan role="tab" o role="radio" y tabIndex 0 sólo la elegida.
 */
export function onRovingKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const move = KEYS[e.key];
  if (!move) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]'))
    .filter((el) => !(el as HTMLButtonElement).disabled);
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  const index = move === "first" ? 0
    : move === "last" ? items.length - 1
    : (Math.max(current, 0) + (move === "next" ? 1 : -1) + items.length) % items.length;
  e.preventDefault();
  items[index]!.focus();
  items[index]!.click();
}

/** tabIndex de una opción: sólo la elegida entra en el orden de Tab. */
export const rovingTabIndex = (selected: boolean) => (selected ? 0 : -1);
