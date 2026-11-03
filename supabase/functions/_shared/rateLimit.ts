/**
 * Límite de velocidad para las Edge Functions (protección contra bots y
 * contra el abuso de las funciones públicas).
 *
 * Cada llamada se anota en public.edge_rate_limits con una clave: la IP de
 * quien llama pasada por HMAC-SHA-256 (la IP en claro nunca se guarda) o el id
 * de la persona con sesión. Si la clave pasa del máximo en la ventana, la
 * función responde 429.
 *
 * Si la base no responde, se deja pasar la llamada (y se anota el error): un
 * fallo del contador no debe dejar a nadie fuera de su cuenta.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

const SECRET = Deno.env.get("RATE_LIMIT_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** IP de quien llama, tal como la pasa el proxy de Supabase. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "desconocida";
}

async function hmacHex(text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Clave anónima para una IP: la misma IP da siempre la misma clave. */
export async function ipKey(scope: string, req: Request): Promise<string> {
  return `${scope}:ip:${await hmacHex(clientIp(req))}`;
}

/** true si la llamada entra en el límite; false si hay que frenarla. */
export async function allow(admin: SupabaseClient, key: string, max: number, window: string): Promise<boolean> {
  const { data, error } = await admin.rpc("hit_edge_rate_limit", { p_key: key, p_max: max, p_window: window });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data !== false;
}

export const TOO_MANY = "Vas muy rápido: espera unos minutos y vuelve a intentarlo.";
