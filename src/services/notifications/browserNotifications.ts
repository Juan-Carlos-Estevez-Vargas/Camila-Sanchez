/**
 * Notificaciones del sistema operativo (cuando la pestaña está en segundo
 * plano) y suscripción Web Push (para que lleguen al celular con la app
 * cerrada, en su pantalla de notificaciones).
 */
import { config, isDemoMode } from "@/core/config";
import type { PushRepository } from "@/data/ports";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** iPhone o iPad (los iPad nuevos se presentan como Mac con pantalla táctil). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** ¿Se abrió como app instalada (desde el ícono de la pantalla de inicio)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** En iPhone los avisos sólo funcionan con la app agregada a la pantalla de inicio. */
export const needsHomeScreenInstall = () => isIos() && !isStandalone();

export const pushSupported = () =>
  notificationsSupported() && "serviceWorker" in navigator && "PushManager" in window;

let publicKey: Promise<string> | null = null;

/**
 * Clave pública VAPID: la de VITE_VAPID_PUBLIC_KEY o, si no está, la que
 * entrega la Edge Function send-push (así no hay que configurarla en Netlify).
 */
export function vapidPublicKey(): Promise<string> {
  if (config.vapidPublicKey) return Promise.resolve(config.vapidPublicKey);
  if (isDemoMode) return Promise.resolve("");
  publicKey ??= fetch(`${config.supabaseUrl}/functions/v1/send-push`)
    .then((res) => (res.ok ? res.json() : {}))
    .then((data: { publicKey?: unknown }) => (typeof data.publicKey === "string" ? data.publicKey : ""))
    .catch(() => "")
    .then((key) => {
      if (!key) publicKey = null; // se reintenta la próxima vez
      return key;
    });
  return publicKey;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Muestra una notificación local si hay permiso y la pestaña no está visible. */
export async function showLocalNotification(title: string, body: string, link: string | null): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  // Con push activo el aviso ya llega por el servidor: no se duplica.
  if (await currentSubscription().catch(() => null)) return;
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = { body, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", tag: link ?? "love", data: { link } };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

/**
 * Registra (o renueva) la suscripción push de este dispositivo a nombre de
 * quien tiene la sesión. No pide permiso: sólo actúa si ya lo dio.
 * Devuelve true si el dispositivo quedó listo para recibir push.
 */
export async function syncPushSubscription(push: PushRepository): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const key = await vapidPublicKey();
  if (!key) return false;
  const serverKey = urlBase64ToUint8Array(key);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  const json = subscription.toJSON();
  await push.register({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 200),
  });
  return true;
}

/**
 * Pide permiso y registra la suscripción push del dispositivo. Devuelve el
 * permiso final. Sin servidor de push sólo se activan las notificaciones locales.
 */
export async function enableNotifications(push: PushRepository): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "granted") await syncPushSubscription(push);
  return permission;
}

/** Al cerrar sesión: este dispositivo deja de recibir los avisos de la cuenta. */
export async function disablePushOnThisDevice(push: PushRepository): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await push.unregister(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}
