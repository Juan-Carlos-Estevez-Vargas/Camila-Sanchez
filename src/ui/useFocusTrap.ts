import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

/** Diálogos abiertos, el último encima: sólo ese atrapa el foco. */
const stack: HTMLElement[] = [];

/** ¿Es el diálogo de más arriba? (Esc sólo debe cerrar ese.) */
export const isTopDialog = (el: HTMLElement | null) => el !== null && stack.at(-1) === el;

/**
 * Foco de un diálogo modal (WCAG 2.1.2, 2.4.3): al abrir lo lleva adentro
 * (al primer campo, o al elemento con data-autofocus), Tab y Shift+Tab dan
 * la vuelta sin salir, y al cerrar vuelve a donde estaba.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, { initial = "input, textarea, select, button" } = {}): void {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = container.querySelector<HTMLElement>("[data-autofocus]") ?? container.querySelector<HTMLElement>(initial);
    if (first) first.focus();
    else {
      container.tabIndex = -1;
      container.focus();
    }

    stack.push(container);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || stack.at(-1) !== container) return;
      const items = focusables(container);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0]!;
      const tail = items.at(-1)!;
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? tail : head).focus();
      } else if (e.shiftKey && (active === head || active === container)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && active === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(container), 1);
      // Si quien abrió el diálogo ya no existe (p. ej. se borró), no forzamos nada.
      if (previous?.isConnected) previous.focus();
    };
  }, [ref, initial]);
}
