import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isTopDialog, useFocusTrap } from "./useFocusTrap";

interface ModalProps {
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Diálogo accesible: Esc para cerrar, foco atrapado adentro y bloqueo del scroll. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(dialogRef);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopDialog(dialogRef.current)) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={`modal${wide ? " modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">{title}</h2>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
