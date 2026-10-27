/* Service worker: caché para que cargue rápido (y sin conexión) y
 * notificaciones push cuando la app está cerrada. */
const VERSION = "v4";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
/* Fotos de Supabase Storage. No depende de VERSION: un despliegue nuevo no
 * obliga a descargar otra vez todas las fotos. La app la borra al cerrar
 * sesión (src/data/localCache.ts). */
const MEDIA_CACHE = "media-v1";
const MEDIA_MAX_ENTRIES = 600;

/** Sólo rutas del propio sitio ("/chat"); nunca "//otro-sitio" ni "https://…". */
function internalLink(link) {
  if (typeof link !== "string" || !/^\/(?![/\\])/.test(link) || /[\u0000-\u001f]/.test(link)) return "/";
  return link;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES_CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icons/heart.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== MEDIA_CACHE && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Las fotos de Supabase Storage nunca cambian (cada subida tiene una ruta
 * nueva), pero su URL firmada sí cambia cada hora por el token. Se guardan
 * por ruta, sin el token: la segunda vez salen del dispositivo al instante,
 * aunque la URL sea otra.
 */
const SIGNED_MEDIA = /^\/storage\/v1\/(object|render\/image)\/sign\//;

function mediaKey(url) {
  const params = new URLSearchParams(url.search);
  params.delete("token");
  const rest = params.toString();
  return `${url.origin}${url.pathname}${rest ? `?${rest}` : ""}`;
}

async function trimMedia(cache) {
  const keys = await cache.keys();
  // cache.keys() respeta el orden de inserción: se van las más antiguas.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MEDIA_MAX_ENTRIES)).map((k) => cache.delete(k)));
}

async function cachedMedia(request, url) {
  const key = mediaKey(url);
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  let res;
  try {
    // Con CORS la respuesta no es opaca: ocupa lo que pesa de verdad y se
    // puede saber si salió bien antes de guardarla.
    res = await fetch(url.href, { mode: "cors", credentials: "omit" });
  } catch {
    return fetch(request);
  }
  if (res.ok) {
    await cache.put(key, res.clone());
    void trimMedia(cache);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.destination === "image" && url.hostname.endsWith(".supabase.co") && SIGNED_MEDIA.test(url.pathname)) {
    event.respondWith(cachedMedia(request, url));
    return;
  }
  // Ningún otro dato de Supabase se cachea (privado y con sesión).
  if (url.origin !== self.location.origin) return;

  // Archivos con hash: inmutables → primero caché.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
    return;
  }

  // Navegación: primero red, si no hay conexión la última versión guardada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Tienes algo nuevo 💌", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Tienes algo nuevo 💌";
  // Los mensajes del chat se agrupan en un solo aviso que se actualiza (como
  // WhatsApp), igual que lo que pasa en cada lista; las notitas y sorpresas
  // llegan cada una por separado.
  const tag = data.kind === "chat" ? "chat"
    : data.kind === "list" && typeof data.link === "string" ? `list:${data.link}`
    : `${data.kind || "aviso"}-${Date.now()}`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag,
      renotify: true,
      vibrate: [80, 40, 80],
      data: { link: internalLink(data.link) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = internalLink(event.notification.data && event.notification.data.link);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
