/**
 * Notificaciones del sistema operativo (cuando la pestaña está en segundo
 * plano) y suscripción Web Push (cuando la app está cerrada).
 */
import { config } from "@/core/config";
import type { PushRepository } from "@/data/ports";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** Muestra una notificación local si hay permiso y la pestaña no está visible. */
export async function showLocalNotification(title: string, body: string, link: string | null): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = { body, icon: "/icons/heart.svg", badge: "/icons/heart.svg", tag: link ?? "love", data: { link } };
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

export const pushSupported = () =>
  notificationsSupported() && "serviceWorker" in navigator && "PushManager" in window && !!config.vapidPublicKey;

/**
 * Pide permiso y registra la suscripción push del dispositivo. Devuelve el
 * permiso final. Sin clave VAPID sólo se activan las notificaciones locales.
 */
export async function enableNotifications(push: PushRepository): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted" || !pushSupported()) return permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    }));
  const json = subscription.toJSON();
  await push.register({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 200),
  });
  return permission;
}
