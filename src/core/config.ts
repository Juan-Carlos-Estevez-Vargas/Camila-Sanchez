/**
 * Configuración leída del entorno de Vite. Sólo variables públicas: la
 * service_role key NUNCA debe llegar al navegador.
 */
const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "",
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "",
  vapidPublicKey: (env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? "",
} as const;

/**
 * Sin credenciales de Supabase la app arranca en "modo demo": guarda todo en
 * el navegador para poder probarla sin crear ninguna cuenta.
 */
export const isDemoMode = !config.supabaseUrl || !config.supabaseAnonKey;
