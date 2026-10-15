import { useState, type ReactNode } from "react";
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

  return (
    <ul className={`sortable ${className}`}>
      {items.map((item, index) => (
        <li
          key={getId(item)}
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
              <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Subir" disabled={index === 0}
                onClick={() => onReorder(move(items, index, index - 1))}>↑</button>
              <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Bajar" disabled={index === items.length - 1}
                onClick={() => onReorder(move(items, index, index + 1))}>↓</button>
            </div>
          )}
          <div className="sortable__body">{render(item, index)}</div>
        </li>
      ))}
    </ul>
  );
}
