/**
 * Botón de donación voluntaria del pie de página.
 *
 * Es un enlace normal a una plataforma externa (Ko-fi, Buy Me a Coffee,
 * GitHub Sponsors, PayPal…): la app no carga scripts ni widgets de ella, no
 * procesa pagos y no ve ningún dato de quien dona. Por eso no hace falta
 * tocar la CSP ni el aviso de cookies. Sin URL configurada, no se muestra.
 */

export interface DonationLink {
  url: string;
  /** Nombre de la plataforma para el texto accesible. */
  platform: string;
}

const PLATFORMS: { host: RegExp; name: string }[] = [
  { host: /(^|\.)ko-fi\.com$/, name: "Ko-fi" },
  { host: /(^|\.)buymeacoffee\.com$/, name: "Buy Me a Coffee" },
  { host: /^github\.com$/, name: "GitHub Sponsors" },
  { host: /(^|\.)paypal\.(me|com)$/, name: "PayPal" },
  { host: /(^|\.)patreon\.com$/, name: "Patreon" },
];

/**
 * Valida la URL de VITE_DONATION_URL. Sólo se aceptan direcciones https sin
 * usuario ni contraseña; cualquier otra cosa (vacía, javascript:, http:)
 * apaga el botón en vez de mostrar un enlace peligroso.
 */
export function parseDonationUrl(raw: string | undefined): DonationLink | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const platform = PLATFORMS.find((p) => p.host.test(host))?.name ?? host.replace(/^www\./, "");
  return { url: url.href, platform };
}
