import { useEffect, useRef } from "react";
import { STICKERS } from "@/domain/stickers";
import { StickerArt } from "./StickerArt";

/** Panel de stickers sobre la caja de texto. Esc o un clic fuera lo cierran. */
export function StickerPicker({ onPick, onClose }: { onPick(id: string): void; onClose(): void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current && !panel.current.contains(target) && !(target instanceof Element && target.closest("[data-sticker-toggle]"))) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  return (
    <div ref={panel} className="sticker-picker card" role="dialog" aria-label="Stickers">
      <div className="sticker-picker__grid">
        {STICKERS.map((s) => (
          <button key={s.id} type="button" className="sticker-picker__item" onClick={() => onPick(s.id)} aria-label={`Enviar sticker ${s.text}`}>
            <StickerArt id={s.id} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}
