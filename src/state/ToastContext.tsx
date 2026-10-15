import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi["show"] = ({ durationMs = 5000, tone = "info", ...toast }) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-3), { ...toast, tone, id }]);
      window.setTimeout(() => dismiss(id), durationMs);
    };
    return {
      show,
      success: (title, body) => show({ title, body, tone: "success" }),
      error: (error, title = "Ups") => show({ title, body: toUserMessage(error), tone: "error", durationMs: 7000 }),
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
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
            <button className="btn btn--icon btn--ghost btn--sm" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return api;
}
