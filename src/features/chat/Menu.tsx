import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

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
}

/**
 * Menú desplegable con el patrón ARIA «menu button»: flechas para moverse,
 * Inicio/Fin, Esc o un clic fuera para cerrar (el foco vuelve al botón).
 */
export function Menu({ label, trigger, items, header, align = "end", up, className = "", open: controlled, onOpenChange, tourId }: MenuProps) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (value: boolean) => {
    setOwn(value);
    onOpenChange?.(value);
  };
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visible = items.filter((i) => !i.hidden);
  // Cerca del borde inferior se abre hacia arriba para no quedar cortado.
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open || up !== undefined || !button.current) return;
    setFlip(button.current.getBoundingClientRect().bottom > window.innerHeight * 0.58);
  }, [open, up]);
  const closeRef = useRef(() => setOpen(false));
  closeRef.current = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"], [data-menu-first]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

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
      {open && (
        <div
          id={menuId}
          className={`menu__panel card menu__panel--${align}${(up ?? flip) ? " menu__panel--up" : ""}`}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
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
      )}
    </div>
  );
}
