/**
 * Sólo deja volver a rutas internas de la app ("/panel", "/chat?x=1").
 * Evita redirecciones abiertas como "?next=//sitio-malo.com" o "https://…".
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  const hasControlChars = [...next].some((c) => c.charCodeAt(0) < 0x20);
  return hasControlChars ? fallback : next;
}
