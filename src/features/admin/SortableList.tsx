import { useEffect, useRef, useState, type ReactNode } from "react";
import { move } from "./reorder";

interface Props<T> {
  items: T[];
  getId(item: T): string;
  render(item: T, index: number): ReactNode;
  onReorder(items: T[]): void;
  disabled?: boolean;
  className?: string;
}

/**
 * Lista ordenable: arrastrar y soltar con ratón y botones ↑ ↓ (accesibles
 * con teclado y cómodos en el teléfono, donde arrastrar es torpe).
 */
export function SortableList<T>({ items, getId, render, onReorder, disabled, className = "" }: Props<T>) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLUListElement>(null);
  // Tras mover con ↑ ↓ el foco sigue en el mismo botón del elemento movido.
  const refocus = useRef<{ id: string; dir: "up" | "down" } | null>(null);

  useEffect(() => {
    const pending = refocus.current;
    if (!pending || !list.current) return;
    refocus.current = null;
    const item = list.current.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(pending.id)}"]`);
    const button = item?.querySelector<HTMLButtonElement>(`[data-sort-dir="${pending.dir}"]:not(:disabled)`)
      ?? item?.querySelector<HTMLButtonElement>("[data-sort-dir]:not(:disabled)");
    button?.focus();
  }, [items]);

  const moveBy = (index: number, delta: -1 | 1) => {
    refocus.current = { id: getId(items[index]!), dir: delta < 0 ? "up" : "down" };
    setAnnouncement(`Movido a la posición ${index + delta + 1} de ${items.length}`);
    onReorder(move(items, index, index + delta));
  };

  return (
    <>
    <span className="visually-hidden" role="status">{announcement}</span>
    <ul ref={list} className={`sortable ${className}`}>
      {items.map((item, index) => (
        <li
          key={getId(item)}
          data-sort-id={getId(item)}
          className={`sortable__item${dragging === index ? " is-dragging" : ""}${over === index && dragging !== index ? " is-over" : ""}`}
          draggable={!disabled}
          onDragStart={(e) => {
            setDragging(index);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setOver(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== index) onReorder(move(items, dragging, index));
            setDragging(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
        >
          {!disabled && (
            <div className="sortable__handle">
              <button type="button" className="btn btn--icon btn--ghost btn--sm" data-sort-dir="up" disabled={index === 0}
                aria-label={`Subir (posición ${index + 1} de ${items.length})`} onClick={() => moveBy(index, -1)}><span aria-hidden>↑</span></button>
              <button type="button" className="btn btn--icon btn--ghost btn--sm" data-sort-dir="down" disabled={index === items.length - 1}
                aria-label={`Bajar (posición ${index + 1} de ${items.length})`} onClick={() => moveBy(index, 1)}><span aria-hidden>↓</span></button>
            </div>
          )}
          <div className="sortable__body">{render(item, index)}</div>
        </li>
      ))}
    </ul>
    </>
  );
}
