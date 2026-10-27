import { memo, useEffect, useMemo, useState } from "react";
import type { EffectsConfig } from "@/domain/types";
import { prefersReducedMotion, useReducedMotion } from "@/ui/motion";
import "./effects.scss";

/**
 * Emojis flotando de fondo. Todo es CSS (transform/opacity, en GPU); JS sólo
 * crea los elementos una vez. Se reduce la cantidad en móviles y se apaga si
 * la persona pidió menos movimiento.
 */
export const FloatingEffects = memo(function FloatingEffects({ effects }: { effects: EffectsConfig }) {
  // Se apaga con prefers-reduced-motion o con "Reducir animaciones" del pie.
  const reduced = useReducedMotion();
  const [mobile] = useState(() => matchMedia("(max-width: 640px)").matches);

  const count = !effects.floating.enabled || reduced
    ? 0
    : Math.round(effects.floating.density * (mobile && effects.reduceOnMobile ? 0.5 : 1));

  const items = useMemo(() => {
    const emojis = effects.floating.emojis;
    return Array.from({ length: count }, (_, i) => ({
      emoji: emojis[i % emojis.length],
      left: `${(i * 61) % 100}%`,
      size: `${0.9 + ((i * 7) % 10) / 8}rem`,
      duration: `${14 + ((i * 13) % 12)}s`,
      delay: `-${(i * 3.7) % 20}s`,
    }));
  }, [count, effects.floating.emojis]);

  useEffect(() => {
    if (!effects.cursorHearts || reduced) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 90) return; // throttle
      last = now;
      const heart = document.createElement("span");
      heart.className = "cursor-heart";
      heart.textContent = "💗";
      heart.style.left = `${e.clientX}px`;
      heart.style.top = `${e.clientY}px`;
      document.body.appendChild(heart);
      heart.addEventListener("animationend", () => heart.remove(), { once: true });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [effects.cursorHearts, reduced]);

  if (!count) return null;
  return (
    <div className="floating" aria-hidden>
      {items.map((item, i) => (
        <span key={i} style={{ left: item.left, fontSize: item.size, animationDuration: item.duration, animationDelay: item.delay }}>
          {item.emoji}
        </span>
      ))}
    </div>
  );
});

/** Lluvia breve de emojis (para sorpresas e interrupciones). */
export function burst(emojis: string[], amount = 36): void {
  if (prefersReducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "burst";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < amount; i++) {
    const s = document.createElement("span");
    s.textContent = emojis[i % emojis.length] ?? "💖";
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.8}s`;
    s.style.fontSize = `${1 + Math.random() * 1.4}rem`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4500);
}
