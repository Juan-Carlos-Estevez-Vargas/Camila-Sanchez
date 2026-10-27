import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { prefersReducedMotion } from "@/ui/motion";
import { placePopover, spotlightBox, type Box, type PopoverPosition } from "./tourLayout";
import { tourFor, type TourStep } from "./tourSteps";

/** Recordatorio (sólo en este navegador) de que ya se abrió el tutorial. */
const SEEN_KEY = "tour:seen";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Almacenamiento bloqueado (modo privado): el botón sigue funcionando.
  }
}

function isVisible(el: Element): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/** Primer destino visible del paso (y si es el alternativo), o `null`. */
function findTarget(step: TourStep): { element: HTMLElement; fallback: boolean } | null {
  for (const [i, selector] of (step.target ?? []).entries()) {
    const element = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
    if (element) return { element, fallback: i > 0 };
  }
  return null;
}


/**
 * Tutorial guiado. El botón vive siempre en la cabecera: al tocarlo empieza
 * el recorrido de la página actual, y Cerrar (o Esc) lo termina.
 */
export function GuidedTour() {
  const { user, profile, policy } = useAuth();
  const { pathname } = useLocation();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState(readSeen);
  const launcher = useRef<HTMLButtonElement>(null);
  const current = steps?.[index];

  const start = () => {
    const all = tourFor({ pathname, loggedIn: Boolean(user), displayName: profile?.displayName, policy });
    setSteps(all.filter((s) => !s.optional || findTarget(s)));
    setIndex(0);
    if (!seen) {
      markSeen();
      setSeen(true);
    }
  };

  const close = useCallback(() => {
    setSteps(null);
    launcher.current?.focus();
  }, []);

  // Cambiar de página termina el recorrido: sus pasos eran de la anterior.
  useEffect(() => setSteps(null), [pathname]);

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`btn btn--sm btn--soft tour-launcher${seen ? "" : " is-new"}`}
        data-tour="tour-launcher"
        aria-haspopup="dialog"
        aria-expanded={steps !== null}
        onClick={() => (steps ? close() : start())}
      >
        <span aria-hidden className="tour-launcher__icon">?</span>
        <span className="tour-launcher__label">Tutorial</span>
      </button>
      {steps && current && createPortal(
        <TourOverlay steps={steps} step={current} index={index} onIndex={setIndex} onClose={close} />,
        document.body,
      )}
    </>
  );
}

function TourOverlay({ steps, step, index, onIndex, onClose }: {
  steps: TourStep[];
  step: TourStep;
  index: number;
  onIndex(index: number): void;
  onClose(): void;
}) {
  const isLast = index === steps.length - 1;
  const titleId = useId();
  const bodyId = useId();
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<Box | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [fallback, setFallback] = useState(false);

  const measure = useCallback(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const target = findTarget(step);
    setFallback(target?.fallback ?? false);
    const rect = target?.element.getBoundingClientRect();
    const box = rect ? spotlightBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }, viewport) : null;
    // Un destino fuera de la pantalla (por ejemplo, aún desplazándose) no se resalta.
    const shown = box && box.width > 0 && box.height > 0 ? box : null;
    setSpot(shown);
    const size = card.current ? { width: card.current.offsetWidth, height: card.current.offsetHeight } : { width: 360, height: 220 };
    setPosition(placePopover(shown, size, viewport));
  }, [step]);

  // Lleva el destino a la vista y lo sigue al desplazar o cambiar el tamaño.
  useLayoutEffect(() => {
    findTarget(step)?.element.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    measure();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (card.current) observer?.observe(card.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [step, measure]);

  useEffect(() => next.current?.focus(), [index]);

  const go = useCallback((to: number) => {
    if (to < 0) return;
    if (to >= steps.length) onClose();
    else onIndex(to);
  }, [steps.length, onClose, onIndex]);

  // Teclado en todo el documento: Esc cierra aunque el foco esté fuera.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        go(index - 1);
      } else if (e.key === "Tab" && card.current) {
        // El foco no sale de la tarjeta mientras el recorrido está abierto.
        const focusable = Array.from(card.current.querySelectorAll<HTMLElement>("button"));
        const first = focusable[0];
        const last = focusable.at(-1);
        const inside = card.current.contains(document.activeElement);
        if (!inside || (e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, index, onClose]);

  return (
    <div className="tour">
      {/* Bloquea los clics en la página mientras dura el recorrido. */}
      <div className={`tour__backdrop${spot ? "" : " is-dim"}`} aria-hidden />
      {spot && (
        <div
          className="tour__spot"
          aria-hidden
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div
        ref={card}
        className={`tour__card card tour__card--${position?.placement ?? "center"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        style={position ? { top: position.top, left: position.left } : { opacity: 0 }}
      >
        <div className="tour__head">
          <span className="tour__progress" aria-live="polite">{index + 1} de {steps.length}</span>
          <button type="button" className="btn btn--icon btn--ghost btn--sm tour__close" aria-label="Cerrar tutorial" onClick={onClose}>✕</button>
        </div>
        <h2 id={titleId} className="tour__title">{step.title}</h2>
        <p id={bodyId} className="tour__body">
          {step.body}
          {fallback && step.fallbackNote && <> {step.fallbackNote}</>}
        </p>
        <div className="tour__dots" aria-hidden>
          {steps.map((s, i) => <span key={s.id} className={i === index ? "is-active" : ""} />)}
        </div>
        <div className="tour__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>Cerrar</button>
          <span className="grow" />
          {index > 0 && <button type="button" className="btn btn--sm btn--soft" onClick={() => go(index - 1)}>Anterior</button>}
          <button ref={next} type="button" className="btn btn--sm" onClick={() => go(index + 1)}>
            {isLast ? "Terminar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
