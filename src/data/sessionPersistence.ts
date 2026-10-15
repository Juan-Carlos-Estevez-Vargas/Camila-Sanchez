/**
 * Dónde vive la sesión: con "Mantener la sesión iniciada" se guarda en
 * localStorage (sobrevive al cerrar el navegador); sin ella, en
 * sessionStorage (muere al cerrar la pestaña, ideal en equipos compartidos).
 *
 * La app no usa cookies: Supabase Auth guarda el token en este almacenamiento
 * y la Content-Security-Policy impide que un script ajeno lo lea.
 */
const REMEMBER_KEY = "love-remember-session";

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function setRememberSession(remember: boolean): void {
  attempt(() => localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"), undefined);
}

export function remembersSession(): boolean {
  return attempt(() => localStorage.getItem(REMEMBER_KEY), null) !== "0";
}

/** Almacenamiento compatible con la opción auth.storage de supabase-js. */
export const sessionAwareStorage = {
  getItem(key: string): string | null {
    return attempt(() => sessionStorage.getItem(key), null) ?? attempt(() => localStorage.getItem(key), null);
  },
  setItem(key: string, value: string): void {
    const [keep, drop] = remembersSession() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    attempt(() => keep.setItem(key, value), undefined);
    attempt(() => drop.removeItem(key), undefined);
  },
  removeItem(key: string): void {
    attempt(() => sessionStorage.removeItem(key), undefined);
    attempt(() => localStorage.removeItem(key), undefined);
  },
};
