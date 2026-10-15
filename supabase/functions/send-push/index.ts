/**
 * Edge Function: envía notificaciones Web Push.
 *
 * La dispara un Database Webhook (INSERT en public.notifications). Busca las
 * suscripciones del destinatario y les envía el aviso; las suscripciones
 * caducadas (404/410) se borran solas.
 *
 * Secretos necesarios: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * (p. ej. mailto:tu@correo.com) y PUSH_WEBHOOK_SECRET.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");

interface NotificationRow {
  user_id: string;
  title: string;
  body: string;
  link: string | null;
}

/** Comparación en tiempo constante para no filtrar el secreto por tiempos. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!SECRET || !safeEqual(req.headers.get("x-webhook-secret") ?? "", SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRow | undefined;
  if (payload?.type !== "INSERT" || !record?.user_id) return new Response("ignored");

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", record.user_id);
  const message = JSON.stringify({ title: record.title, body: record.body, link: record.link ?? "/" });

  const results = await Promise.allSettled((subs ?? []).map(async (s) => {
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
