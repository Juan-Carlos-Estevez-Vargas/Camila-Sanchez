import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  icon?: string;
  onSelect(): void;
  danger?: boolean;
  hidden?: boolean;
}

interface MenuProps {
  /** Nombre del botón para lectores de pantalla. */
  label: string;
  /** Contenido visible del botón. */
  trigger: ReactNode;
  items: MenuItem[];
  /** Contenido extra arriba de las opciones (p. ej. las reacciones). */
  header?: (close: () => void) => ReactNode;
  align?: "start" | "end";
  /** Abre hacia arriba (cerca del borde inferior). */
  up?: boolean;
  className?: string;
  /** Para abrirlo desde fuera (mantener pulsado un mensaje). */
  open?: boolean;
  onOpenChange?(open: boolean): void;
  tourId?: string;
  /** Lo que se muestra arriba del panel en el celular (p. ej. el mensaje). */
  preview?: ReactNode;
}

/** En el celular el menú sube desde abajo, a lo ancho, para que nunca quede cortado. */
const SHEET_QUERY = "(max-width: 640px), (hover: none) and (pointer: coarse)";
const matchesSheet = () => typeof matchMedia !== "undefined" && matchMedia(SHEET_QUERY).matches;

function useSheet(): boolean {
  const [sheet, setSheet] = useState(matchesSheet);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mql = matchMedia(SHEET_QUERY);
    const sync = () => setSheet(mql.matches);
    mql.addEventListener?.("change", sync);
    return () => mql.removeEventListener?.("change", sync);
  }, []);
  return sheet;
}

/**
 * Menú desplegable con el patrón ARIA «menu button»: flechas para moverse,
 * Inicio/Fin, Esc o un clic fuera para cerrar (el foco vuelve al botón).
 * En pantallas pequeñas o táctiles se abre como hoja inferior con fondo.
 */
export function Menu({ label, trigger, items, header, align = "end", up, className = "", open: controlled, onOpenChange, tourId, preview }: MenuProps) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (value: boolean) => {
    setOwn(value);
    onOpenChange?.(value);
  };
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sheet = useSheet();
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visible = items.filter((i) => !i.hidden);
  // Cerca del borde inferior se abre hacia arriba para no quedar cortado.
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open || sheet || up !== undefined || !button.current) return;
    setFlip(button.current.getBoundingClientRect().bottom > window.innerHeight * 0.58);
  }, [open, up, sheet]);
  const closeRef = useRef(() => setOpen(false));
  closeRef.current = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    // En la hoja (táctil) el foco va al panel para no marcar una reacción como elegida.
    const first = sheet ? panel.current : panel.current?.querySelector<HTMLElement>('[role="menuitem"], [data-menu-first]');
    first?.focus({ preventScroll: true });
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, sheet]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'));
    const index = all.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? index + 1 : e.key === "ArrowUp" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (next === null || all.length === 0) return;
    e.preventDefault();
    all[(next + all.length) % all.length]!.focus();
  };

  const content = (modifier: string) => (
    <div
      ref={panel}
      id={menuId}
      className={`menu__panel card${modifier}`}
      role="menu"
      aria-label={label}
      tabIndex={sheet ? -1 : undefined}
      onKeyDown={onKeyDown}
    >
      {sheet && preview && <div className="menu__preview" aria-hidden>{preview}</div>}
      {header?.(() => close())}
      {visible.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={`menu__item${item.danger ? " is-danger" : ""}`}
          onClick={() => {
            close();
            item.onSelect();
          }}
        >
          {item.icon && <span className="menu__icon" aria-hidden>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`menu ${className}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="btn btn--icon btn--ghost menu__button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-tour={tourId}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (sheet
        ? createPortal(
          // Lo que pasa en la hoja no llega a la fila del mensaje (deslizar, mantener pulsado).
          <div
            className="menu-sheet"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) close();
            }}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {content(" menu__panel--sheet")}
          </div>,
          document.body,
        )
        : content(` menu__panel--${align}${(up ?? flip) ? " menu__panel--up" : ""}`))}
    </div>
  );
}
