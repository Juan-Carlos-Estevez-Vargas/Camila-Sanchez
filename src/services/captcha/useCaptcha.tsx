/**
 * CAPTCHA contra bots con Cloudflare Turnstile (protección que Supabase Auth
 * comprueba al entrar, pedir enlace mágico o recuperar la contraseña, y que
 * redeem-invite comprueba al crear una cuenta con una invitación).
 *
 * Sólo se activa si VITE_TURNSTILE_SITE_KEY tiene valor; sin ella (o en modo
 * demo) no carga nada de Cloudflare y take() devuelve undefined.
 *
 * Uso: const captcha = useCaptcha(); … {captcha.widget} …
 *      await backend.auth.signInWithPassword(email, pass, { captchaToken: await captcha.take() });
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { config, isDemoMode } from "@/core/config";
import { AppError } from "@/core/errors";
import { CaptchaTokenQueue } from "./tokenQueue";
import { getLocale, msg } from "@/i18n";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const WAIT_MS = 60_000;

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("turnstile"));
    };
    document.head.append(script);
  });
  return loading;
}

export const captchaEnabled = Boolean(config.turnstileSiteKey) && !isDemoMode;

export interface Captcha {
  enabled: boolean;
  /** El recuadro de Cloudflare (null si el CAPTCHA está apagado). */
  widget: ReactNode;
  /** Mensaje si la verificación no pudo cargar o falló. */
  error: string | null;
  /** Una ficha de un solo uso para mandar con la petición. */
  take(): Promise<string | undefined>;
}

export function useCaptcha(): Captcha {
  // Callback ref: el recuadro se dibuja cuando el formulario aparece, aunque
  // la página muestre antes otra cosa (p. ej. "comprobando la invitación").
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const queue = useMemo(() => new CaptchaTokenQueue(), []);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Cada ficha sirve una vez: se pide la siguiente para el próximo intento.
    setTimeout(() => {
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }, 0);
  }, []);

  useEffect(() => {
    if (!captchaEnabled || !container) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId.current = turnstile.render(container, {
          sitekey: config.turnstileSiteKey,
          language: getLocale(),
          theme: "auto",
          callback: (token: string) => {
            setError(null);
            if (queue.offer(token)) refresh();
          },
          "expired-callback": () => queue.expire(),
          "error-callback": () => {
            queue.expire();
            setError(msg().ui.captcha.failed);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError(msg().ui.captcha.notLoaded);
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [container, queue, refresh]);

  const take = useCallback(async () => {
    if (!captchaEnabled) return undefined;
    const hadToken = queue.hasToken;
    try {
      const token = await queue.take(WAIT_MS);
      if (hadToken) refresh();
      return token;
    } catch {
      throw new AppError(msg().ui.captcha.unfinished);
    }
  }, [queue, refresh]);

  const widget = captchaEnabled ? <div ref={setContainer} className="captcha" aria-label={msg().ui.captcha.label} /> : null;
  return { enabled: captchaEnabled, widget, error, take };
}
