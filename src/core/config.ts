/**
 * Configuración leída del entorno de Vite. Sólo variables públicas: la
 * service_role key NUNCA debe llegar al navegador.
 */
import { parseDonationUrl } from "./donation";
import { normalizeSiteUrl } from "./seo";

const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "",
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "",
  vapidPublicKey: (env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? "",
  /** Clave pública de Cloudflare Turnstile (CAPTCHA). Vacía: sin CAPTCHA. */
  turnstileSiteKey: (env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "",
  /** Dominio público (para URLs canónicas y Open Graph). */
  siteUrl: normalizeSiteUrl(env.VITE_SITE_URL as string | undefined),
  /** Poner VITE_SEO_INDEX=false para que ningún buscador indexe el sitio. */
  seoIndexing: (env.VITE_SEO_INDEX as string | undefined)?.trim() !== "false",
  /** Enlace de donación voluntaria del pie de página. Vacío: sin botón. */
  donation: parseDonationUrl(env.VITE_DONATION_URL as string | undefined),
  /** Versión de la app, calculada al compilar (scripts/release.mjs). */
  appVersion: (env.VITE_APP_VERSION as string | undefined) ?? "dev",
} as const;

/**
 * Sin credenciales de Supabase la app arranca en "modo demo": guarda todo en
 * el navegador para poder probarla sin crear ninguna cuenta.
 */
export const isDemoMode = !config.supabaseUrl || !config.supabaseAnonKey;
