/**
 * Edge Function: gestión de usuarios con la service role.
 *
 * La service_role key vive sólo aquí (la inyecta Supabase); el navegador
 * nunca la ve. Cada llamada verifica primero, con el token de quien llama,
 * que tenga el permiso users.manage.
 *
 * Acciones: invite | create | delete | set_active
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const ROLES = ["super_admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function assertNotLastSuperAdmin(userId: string) {
  const { data } = await admin.from("profiles").select("id, role, is_active").eq("role", "super_admin").eq("is_active", true);
  const others = (data ?? []).filter((p) => p.id !== userId);
  const target = (data ?? []).find((p) => p.id === userId);
  if (target && others.length === 0) throw new Error("Debe quedar al menos un super administrador activo");
}

async function setRole(userId: string, role: Role, displayName: string) {
  const { error } = await admin.from("profiles").update({ role, display_name: displayName }).eq("id", userId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    // 1. ¿Quién llama y tiene permiso?
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return json({ error: "Sesión no válida" }, 401);
    const { data: allowed } = await caller.rpc("has_permission", { p_permission: "users.manage" });
    if (allowed !== true) return json({ error: "No tienes permiso para hacer esto" }, 403);

    // 2. Validar entrada
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 20);
    const callerId = userData.user.id;

    switch (action) {
      case "invite":
      case "create": {
        const email = str(body.email, 254).toLowerCase();
        const displayName = str(body.displayName, 80);
        const role = (ROLES as readonly string[]).includes(body.role) ? (body.role as Role) : "viewer";
        if (!EMAIL.test(email) || !displayName) return json({ error: "Correo o nombre inválidos" }, 400);

        let userId: string;
        if (action === "invite") {
          const redirectTo = str(body.redirectTo, 500) || undefined;
          const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo });
          if (error) throw error;
          userId = data.user.id;
        } else {
          const password = typeof body.password === "string" ? body.password : "";
          if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
          const { data, error } = await admin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { display_name: displayName },
          });
          if (error) throw error;
          userId = data.user.id;
        }
        await setRole(userId, role, displayName);
        return json({ ok: true, userId });
      }

      case "delete": {
        const userId = str(body.userId, 64);
        if (!userId) return json({ error: "Falta el usuario" }, 400);
        if (userId === callerId) return json({ error: "No puedes eliminar tu propia cuenta" }, 400);
        await assertNotLastSuperAdmin(userId);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "set_active": {
        const userId = str(body.userId, 64);
        const active = body.active === true;
        if (!userId) return json({ error: "Falta el usuario" }, 400);
        if (userId === callerId && !active) return json({ error: "No puedes desactivar tu propia cuenta" }, 400);
        if (!active) await assertNotLastSuperAdmin(userId);
        // Desactivar también bloquea el inicio de sesión y revoca el refresco del token.
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
        if (error) throw error;
        await admin.from("profiles").update({ is_active: active }).eq("id", userId);
        return json({ ok: true });
      }

      default:
        return json({ error: "Acción desconocida" }, 400);
    }
  } catch (error) {
    console.error("[admin-users]", error);
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 400);
  }
});
