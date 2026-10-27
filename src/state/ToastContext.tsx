import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toUserMessage } from "@/core/errors";

export type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show(toast: Omit<Toast, "id" | "tone"> & { tone?: ToastTone; durationMs?: number }): void;
  success(title: string, body?: string): void;
  error(error: unknown, title?: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

interface Timer {
  handle: number;
  /** Momento en que empezó a contar (0 = en pausa). */
  startedAt: number;
  remainingMs: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, Timer>());
  const paused = useRef(false);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer.handle);
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const startTimer = useCallback((id: number, timer: Timer) => {
    timer.startedAt = Date.now();
    timer.handle = window.setTimeout(() => dismiss(id), timer.remainingMs);
  }, [dismiss]);

  // Los avisos se quedan mientras el mouse o el foco estén encima, para que
  // dé tiempo de leerlos (WCAG 2.2.1).
  const pause = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    for (const timer of timers.current.values()) {
      window.clearTimeout(timer.handle);
      timer.remainingMs = Math.max(1500, timer.remainingMs - (Date.now() - timer.startedAt));
      timer.startedAt = 0;
    }
  }, []);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    for (const [id, timer] of timers.current) startTimer(id, timer);
  }, [startTimer]);

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi["show"] = ({ durationMs = 5000, tone = "info", ...toast }) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-3), { ...toast, tone, id }]);
      const timer: Timer = { handle: 0, startedAt: 0, remainingMs: durationMs };
      timers.current.set(id, timer);
      if (!paused.current) startTimer(id, timer);
    };
    return {
      show,
      success: (title, body) => show({ title, body, tone: "success" }),
      error: (error, title = "Ups") => show({ title, body: toUserMessage(error), tone: "error", durationMs: 7000 }),
    };
  }, [startTimer]);

  // Sin avisos no hay nada que pausar (p. ej. se cerró el que tenía el foco).
  useEffect(() => {
    if (toasts.length === 0) paused.current = false;
  }, [toasts.length]);

  const renderToast = (t: Toast) => (
    <div key={t.id} className={`toast toast--${t.tone}`}>
      <div>
        <div className="toast__title">{t.title}</div>
        {t.body && <div className="toast__body">{t.body}</div>}
        {t.action && (
          <button className="btn btn--sm btn--soft" style={{ marginTop: 8 }} onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
            {t.action.label}
          </button>
        )}
      </div>
      <button className="btn btn--icon btn--ghost btn--sm" aria-label={`Cerrar aviso: ${t.title}`} onClick={() => dismiss(t.id)}>
        <span aria-hidden>×</span>
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Los errores se anuncian de inmediato; lo demás, cuando el lector termine. */}
      <div className="toasts" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
        <div role="alert" aria-live="assertive" className="toasts__group">{toasts.filter((t) => t.tone === "error").map(renderToast)}</div>
        <div role="status" aria-live="polite" className="toasts__group">{toasts.filter((t) => t.tone !== "error").map(renderToast)}</div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return api;
}
