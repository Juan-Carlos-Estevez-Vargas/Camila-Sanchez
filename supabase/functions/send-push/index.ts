/**
 * Edge Function: envía notificaciones Web Push.
 *
 * POST: la llama la base de datos (trigger notifications_push con pg_net)
 * cada vez que hay un aviso nuevo, con la cabecera x-webhook-secret. Busca las
 * suscripciones del destinatario y les envía el aviso; las suscripciones
 * caducadas (404/410) se borran solas.
 *
 * GET: devuelve la clave pública VAPID, que no es secreta, para que el
 * navegador pueda suscribirse sin configurar nada en Netlify.
 *
 * Secretos (los crea el flujo Deploy): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT y PUSH_WEBHOOK_SECRET.
 */
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  PUBLIC_KEY,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");

interface NotificationRow {
  user_id: string;
  kind?: string;
  title: string;
  body: string;
  link: string | null;
}

/**
 * Sólo los servicios de push de los navegadores (igual que la restricción
 * push_subscriptions_endpoint_service de la base): nunca otra dirección.
 */
const PUSH_SERVICE = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

/** Comparación en tiempo constante para no filtrar el secreto por tiempos. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  if (req.method === "GET") {
    return Response.json({ publicKey: PUBLIC_KEY }, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" },
    });
  }
  if (!SECRET || !safeEqual(req.headers.get("x-webhook-secret") ?? "", SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRow | undefined;
  if (payload?.type !== "INSERT" || !record?.user_id) return new Response("ignored");

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", record.user_id);
  const link = typeof record.link === "string" && /^\/(?![/\\])/.test(record.link) ? record.link : "/";
  const message = JSON.stringify({
    title: String(record.title ?? "").slice(0, 160), body: String(record.body ?? "").slice(0, 300),
    link, kind: record.kind ?? "system",
  });

  const targets = (subs ?? []).filter((s) => PUSH_SERVICE.test(s.endpoint));
  const results = await Promise.allSettled(targets.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24 });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      throw error;
    }
  }));

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ sent, failed: results.length - sent });
});
