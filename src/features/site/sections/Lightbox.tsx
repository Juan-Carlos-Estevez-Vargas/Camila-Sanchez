import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatLongDate } from "@/domain/dates";
import type { Photo, PhotoUrls, Uuid } from "@/domain/types";
import { burst } from "../effects/FloatingEffects";

interface Props {
  title: string;
  photos: Photo[];
  urls: Map<Uuid, PhotoUrls>;
  startIndex?: number;
  effect?: string[];
  onClose(): void;
}

/** Visor de fotos: teclado (← → Esc), deslizar con el dedo y precarga. */
export function Lightbox({ title, photos, urls, startIndex = 0, effect, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (effect) burst(effect, 24);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [effect, go, onClose]);

  // Precarga la anterior y la siguiente para que el cambio sea instantáneo.
  useEffect(() => {
    for (const offset of [1, -1]) {
      const p = photos[(index + offset + count) % count];
      const url = p && urls.get(p.id)?.full;
      if (url) new Image().src = url;
    }
  }, [index, photos, urls, count]);

  const photo = photos[index];
  if (!photo) return null;
  const url = urls.get(photo.id);

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="lightbox__top">
        <span>{title}</span>
        <span>{index + 1} / {count}</span>
        <button className="btn btn--icon btn--ghost lightbox__close" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <div className="lightbox__stage">
        {count > 1 && <button className="lightbox__nav is-prev" onClick={() => go(-1)} aria-label="Anterior">‹</button>}
        <figure className="lightbox__figure" key={photo.id}>
          {url ? <img src={url.full} alt={photo.caption || "Recuerdo"} decoding="async" /> : <div className="skeleton lightbox__placeholder" />}
          <figcaption>
            {photo.caption && <p>{photo.caption}</p>}
            <time dateTime={photo.takenOn}>{formatLongDate(photo.takenOn)}</time>
          </figcaption>
        </figure>
        {count > 1 && <button className="lightbox__nav is-next" onClick={() => go(1)} aria-label="Siguiente">›</button>}
      </div>
      {count > 1 && (
        <div className="lightbox__thumbs">
          {photos.map((p, i) => {
            const u = urls.get(p.id);
            return (
              <button key={p.id} className={`lightbox__thumb${i === index ? " is-active" : ""}`} onClick={() => setIndex(i)} aria-label={`Foto ${i + 1}`}>
                {u && <img src={u.thumb} alt="" loading="lazy" decoding="async" />}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
