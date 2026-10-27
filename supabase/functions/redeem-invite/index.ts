/**
 * Edge Function pública: canjea un enlace de invitación.
 *
 * Acciones:
 *   check  { token }                                 → { valid, role }
 *   redeem { token, email, password, displayName }   → { ok }
 *
 * No necesita sesión (quien la llama aún no tiene cuenta). La seguridad está
 * en el token: 256 bits al azar, guardado sólo como SHA-256, de un solo uso y
 * con caducidad. El canje marca la invitación como usada en la misma sentencia
 * que la busca, así dos personas no pueden usar el mismo enlace a la vez.
 */
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { corsHeaders, json } from "../_shared/cors.ts";
import { passwordProblem } from "../_shared/password.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const INVALID = "Este enlace ya no es válido. Pide uno nuevo.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 10);
    const token = typeof body.token === "string" ? body.token : "";
    if (!TOKEN.test(token)) return json({ error: INVALID }, 400);
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();

    if (action === "check") {
      const { data } = await admin.from("invitations").select("role")
        .eq("token_hash", tokenHash).is("used_at", null).gt("expires_at", now).maybeSingle();
      return json(data ? { valid: true, role: data.role } : { valid: false });
    }

    if (action !== "redeem") return json({ error: "Acción desconocida" }, 400);

    const email = str(body.email, 254).toLowerCase();
    const displayName = str(body.displayName, 80);
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL.test(email)) return json({ error: "Escribe un correo válido." }, 400);
    if (!displayName) return json({ error: "Escribe tu nombre." }, 400);
    const weak = passwordProblem(password, [email, displayName]);
    if (weak) return json({ error: weak }, 400);

    // 1. Reservar la invitación (atómico: sólo un canje gana).
    const { data: invite, error: claimError } = await admin.from("invitations")
      .update({ used_at: now })
      .eq("token_hash", tokenHash).is("used_at", null).gt("expires_at", now)
      .select("id, role").maybeSingle();
    if (claimError) throw claimError;
    if (!invite) return json({ error: INVALID }, 410);

    // 2. Crear la cuenta con el rol de la invitación (lo lee handle_new_user).
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
      app_metadata: { app_role: invite.role },
    });
    if (createError || !created.user) {
      // Devolver la invitación para que pueda intentarlo con otro correo.
      await admin.from("invitations").update({ used_at: null }).eq("id", invite.id);
      const taken = /already|registered|exists/i.test(createError?.message ?? "");
      return json({ error: taken ? "Ya existe una cuenta con ese correo." : "No pude crear la cuenta. Inténtalo de nuevo." }, 400);
    }

    await admin.from("invitations").update({ used_by: created.user.id }).eq("id", invite.id);
    return json({ ok: true });
  } catch (error) {
    console.error("[redeem-invite]", error);
    return json({ error: "Error inesperado. Inténtalo de nuevo." }, 500);
  }
});
