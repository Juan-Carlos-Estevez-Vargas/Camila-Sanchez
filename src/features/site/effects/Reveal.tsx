import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SectionAnimation } from "@/domain/types";

/**
 * Anima la entrada de una sección cuando aparece en pantalla. Usa un único
 * IntersectionObserver compartido (más eficiente que uno por sección).
 */
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function observe(element: Element, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onVisible();
    return () => undefined;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          callbacks.get(entry.target)?.();
          observer?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
  );
  callbacks.set(element, onVisible);
  observer.observe(element);
  return () => observer?.unobserve(element);
}

export function Reveal({ animation, children, as: Tag = "section", id, className = "" }: {
  animation: SectionAnimation;
  children: ReactNode;
  as?: "section" | "div";
  id?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(animation === "none");

  useEffect(() => {
    if (animation === "none" || !ref.current) return;
    return observe(ref.current, () => setVisible(true));
  }, [animation]);

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`reveal reveal--${animation}${visible ? " is-visible" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
