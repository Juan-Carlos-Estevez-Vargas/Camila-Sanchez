/**
 * Dónde está corriendo la app: qué celular o computador es y si se abrió
 * como app instalada (desde el ícono) o como página en el navegador.
 * Puro y sin React para poder probarlo y usarlo desde cualquier capa.
 */

export type InstallPlatform = "ios" | "android" | "desktop";

interface Env {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

const currentEnv = (): Env | null =>
  typeof navigator === "undefined"
    ? null
    : { userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints };

/** iPhone o iPad (los iPad nuevos se presentan como Mac con pantalla táctil). */
export function isIos(env: Env | null = currentEnv()): boolean {
  if (!env) return false;
  return /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1);
}

export function detectPlatform(env: Env | null = currentEnv()): InstallPlatform {
  if (!env) return "desktop";
  if (isIos(env)) return "ios";
  if (/Android/i.test(env.userAgent)) return "android";
  return "desktop";
}

/** En iPhone, ¿es Safari? (Chrome, Edge y Firefox de iPhone también instalan desde Compartir, con el botón en otro lugar). */
export function isIosSafari(env: Env | null = currentEnv()): boolean {
  if (!env || !isIos(env)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(env.userAgent);
}

/** ¿Se abrió como app instalada (desde el ícono de la pantalla de inicio)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const media = (q: string) => window.matchMedia?.(q).matches === true;
  return media("(display-mode: standalone)") || media("(display-mode: minimal-ui)")
    || media("(display-mode: window-controls-overlay)")
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
    // Dentro de la app de Play Store (Trusted Web Activity).
    || document.referrer.startsWith("android-app://");
}
