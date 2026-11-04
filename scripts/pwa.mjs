/**
 * Piezas del build para que la app se instale como app de celular.
 *
 *  - precacheList: los archivos del build que el service worker descarga al
 *    instalarse, para que la app abra sin conexión.
 *  - stampServiceWorker: escribe esa lista y una huella de versión en sw.js.
 *  - buildAssetLinks: /.well-known/assetlinks.json, el archivo con el que
 *    Google comprueba que la app de Play Store (Trusted Web Activity) es de
 *    este sitio. Sólo se genera si están ANDROID_PACKAGE_NAME y
 *    ANDROID_CERT_SHA256 (ver docs/APP_CELULAR.md).
 */
import { createHash } from "node:crypto";

const PRECACHEABLE = /\.(js|css|woff2?|svg|png|webp|jpe?g)$/;

/** Rutas absolutas ("/assets/…") de lo que conviene tener sin conexión. */
export function precacheList(fileNames) {
  return [...new Set(fileNames)]
    .filter((f) => f.startsWith("assets/") && PRECACHEABLE.test(f) && !f.endsWith(".map"))
    .sort()
    .map((f) => `/${f}`);
}

/** sw.js con la lista y una VERSION que cambia cuando cambian los archivos. */
export function stampServiceWorker(source, files) {
  const hash = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
  if (!source.includes('const VERSION = "v5-dev";') || !source.includes("const PRECACHE = [];")) {
    throw new Error("sw.js: no encuentro VERSION/PRECACHE para completarlos en el build");
  }
  return source
    .replace('const VERSION = "v5-dev";', `const VERSION = "v5-${hash}";`)
    .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(files)};`);
}

const PACKAGE = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * assetlinks.json, o null si faltan datos. Acepta varias huellas separadas
 * por coma (la de tu llave y la de Play App Signing).
 */
export function buildAssetLinks(packageName, fingerprints) {
  const pkg = (packageName ?? "").trim();
  const prints = (fingerprints ?? "").split(",").map((f) => f.trim().toUpperCase()).filter(Boolean);
  if (!pkg || prints.length === 0) return null;
  if (!PACKAGE.test(pkg)) throw new Error(`ANDROID_PACKAGE_NAME no es válido: ${pkg}`);
  const bad = prints.find((f) => !FINGERPRINT.test(f));
  if (bad) throw new Error(`ANDROID_CERT_SHA256 no es una huella SHA-256 (AA:BB:…): ${bad}`);
  return `${JSON.stringify([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
  }], null, 2)}\n`;
}
