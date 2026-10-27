/**
 * Caché local para que la app abra al instante: el contenido del sitio y las
 * URLs firmadas de las fotos se guardan en el navegador y se pintan mientras
 * llegan los datos frescos (stale-while-revalidate).
 *
 * Se guarda donde vive la sesión (sessionAwareStorage): sin "Mantener la
 * sesión iniciada" muere al cerrar la pestaña. La clave lleva la versión de
 * la app, así un despliegue nuevo nunca pinta datos con la forma vieja.
 */
import { config } from "@/core/config";
import { sessionAwareStorage } from "./sessionPersistence";

const PREFIX = "love-cache:";
/** Fotos del chat, listas, avatares y galería que guarda el service worker. */
export const MEDIA_CACHE_PREFIX = "media-";

const keyOf = (name: string) => `${PREFIX}${config.appVersion}:${name}`;

export function readCache<T>(name: string): T | null {
  try {
    const raw = sessionAwareStorage.getItem(keyOf(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Si el almacenamiento está lleno o bloqueado, simplemente no se guarda. */
export function writeCache(name: string, value: unknown): void {
  try {
    sessionAwareStorage.setItem(keyOf(name), JSON.stringify(value));
  } catch {
    // Sin caché la app sigue funcionando, sólo que sin el arranque instantáneo.
  }
}

function dropKeys(storage: Storage, keep: (key: string) => boolean) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k);
  for (const key of keys) if (key.startsWith(PREFIX) && !keep(key)) storage.removeItem(key);
}

/** Borra lo de versiones anteriores de la app (llamar al arrancar). */
export function pruneOldCaches(): void {
  const current = `${PREFIX}${config.appVersion}:`;
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      if (storage) dropKeys(storage, (key) => key.startsWith(current));
    } catch {
      // Almacenamiento bloqueado: no hay nada que limpiar.
    }
  }
}

/**
 * Al cerrar sesión (o cambiar de cuenta) no puede quedar nada privado en el
 * dispositivo: ni contenido, ni URLs firmadas, ni fotos guardadas por el
 * service worker.
 */
export async function clearPrivateCaches(): Promise<void> {
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      if (storage) dropKeys(storage, () => false);
    } catch {
      // Almacenamiento bloqueado: no hay nada guardado.
    }
  }
  try {
    if (!("caches" in globalThis)) return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(MEDIA_CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
    // Cache Storage no disponible (p. ej. navegación privada).
  }
}
