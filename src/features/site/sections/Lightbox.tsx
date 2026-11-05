import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { formatLongDate } from "@/domain/dates";
import type { Photo, PhotoUrls, Uuid } from "@/domain/types";
import { isTopDialog, useFocusTrap } from "@/ui/useFocusTrap";
import { burst } from "../effects/FloatingEffects";
import { useT } from "@/i18n";

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
  const t = useT().site.lightbox;
  const touchX = useRef<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, { initial: ".lightbox__close" });
  const count = photos.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (effect) burst(effect, 24);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (!isTopDialog(dialog.current)) return;
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

  // La foto grande se descarga aparte; mientras llega se ve la miniatura (que
  // ya está en el dispositivo) en su lugar, en vez de un recuadro vacío.
  // También precarga la anterior y la siguiente para que el cambio sea instantáneo.
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const requested = useRef(new Set<string>());
  useEffect(() => {
    for (const offset of [0, 1, -1]) {
      const p = photos[(index + offset + count) % count];
      const full = p && urls.get(p.id)?.full;
      if (!full || requested.current.has(full)) continue;
      requested.current.add(full);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => setLoaded((s) => new Set(s).add(full));
      img.onerror = () => requested.current.delete(full);
      img.src = full;
    }
  }, [index, photos, urls, count]);

  const photo = photos[index];
  if (!photo) return null;
  const url = urls.get(photo.id);
  const src = url && (loaded.has(url.full) ? url.full : url.thumb);
  const size = photo.width && photo.height
    ? ({ "--w": `${photo.width}px`, "--ratio": photo.width / photo.height } as CSSProperties)
    : undefined;
  const classes = [size ? "has-size" : "", url && src !== url.full ? "is-preview" : ""].filter(Boolean).join(" ") || undefined;

  return createPortal(
    <div
      ref={dialog}
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
        <span aria-live="polite" aria-atomic="true">
          <span aria-hidden>{index + 1} / {count}</span>
          <span className="visually-hidden">{t.position(index + 1, count)}{photo.caption ? `: ${photo.caption}` : ""}</span>
        </span>
        <button className="btn btn--icon btn--ghost lightbox__close" onClick={onClose} aria-label={t.close}><span aria-hidden>×</span></button>
      </div>
      <div className="lightbox__stage">
        {count > 1 && <button className="lightbox__nav is-prev" onClick={() => go(-1)} aria-label={t.prev}><span aria-hidden>‹</span></button>}
        <figure className="lightbox__figure" key={photo.id}>
          {src ? (
            <img src={src} style={size} className={classes} alt={photo.caption || t.fallbackAlt} decoding="async" />
          ) : <div className="skeleton lightbox__placeholder" />}
          <figcaption>
            {photo.caption && <p>{photo.caption}</p>}
            <time dateTime={photo.takenOn}>{formatLongDate(photo.takenOn)}</time>
          </figcaption>
        </figure>
        {count > 1 && <button className="lightbox__nav is-next" onClick={() => go(1)} aria-label={t.next}><span aria-hidden>›</span></button>}
      </div>
      {count > 1 && (
        <div className="lightbox__thumbs" role="group" aria-label={t.all}>
          {photos.map((p, i) => {
            const u = urls.get(p.id);
            return (
              <button key={p.id} className={`lightbox__thumb${i === index ? " is-active" : ""}`} onClick={() => setIndex(i)}
                aria-label={`${t.thumb(i + 1)}${p.caption ? `: ${p.caption}` : ""}`} aria-current={i === index ? "true" : undefined}>
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
