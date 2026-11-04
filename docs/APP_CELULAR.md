# App de celular

*Nuestro rincón* se instala en el celular (y en el computador) como una app:
ícono propio en la pantalla de inicio, pantalla completa sin barra del
navegador, avisos con la app cerrada y apertura sin conexión. Es una
**Progressive Web App (PWA)**: el mismo código de la web, sin tiendas, sin
cuentas de desarrollador y siempre en su última versión.

- [Cómo se instala](#cómo-se-instala)
- [Qué hace la app instalada](#qué-hace-la-app-instalada)
- [Cómo está hecho](#cómo-está-hecho)
- [Publicarla en Google Play (opcional)](#publicarla-en-google-play-opcional)
- [¿Y en la App Store?](#y-en-la-app-store)
- [Probarlo](#probarlo)

Los diagramas están en [DIAGRAMAS.md → App de celular](DIAGRAMAS.md#app-de-celular).

## Cómo se instala

La página **`/app`** («Descarga la app», enlazada en el pie, en **Mi cuenta**
y en un aviso pequeño que sale en el celular) lo explica según el
dispositivo que detecta:

| Dispositivo | Cómo |
| --- | --- |
| Android (Chrome, Edge, Samsung Internet) | Botón **Instalar la app** → «Instalar». Si el navegador no ofrece el diálogo: menú ⋮ → «Instalar app». |
| iPhone / iPad (Safari) | Compartir ⬆️ (abajo) → «Agregar a inicio» → «Agregar». |
| iPhone con Chrome, Edge o Firefox | Compartir ⬆️ (arriba, junto a la dirección) → «Agregar a inicio». |
| Computador (Chrome, Edge) | Botón **Instalar la app**, o el ícono de instalar al final de la barra de direcciones. |
| Mac con Safari | Archivo → «Agregar al Dock». |

En el computador, la página muestra además un **código QR** para abrirla en
el celular.

> En iPhone los avisos push **sólo** funcionan con la app instalada y abierta
> desde el ícono (regla de Apple desde iOS 16.4). Por eso, cuando alguien
> intenta activarlos desde Safari, la app le enseña primero a instalarla.

## Qué hace la app instalada

- **Ícono y pantalla completa** (`display: standalone`), con el color de la
  app en la barra de estado.
- **Atajos**: manteniendo pulsado el ícono aparecen *Chat*, *Cajita* y
  *Listas* (Android y computador).
- **Abre sin conexión**: al instalarse descarga todo el código y los estilos;
  sin internet muestra lo último guardado (las fotos ya vistas también) y un
  aviso «Sin conexión».
- **Avisos al celular** del chat, notitas, sorpresas y listas, aunque esté
  cerrada (ver [Avisos en el celular](DIAGRAMAS.md#avisos-en-el-celular)).
- **Versión nueva**: cuando se publica un cambio, la app lo descarga en
  segundo plano y muestra «✨ Hay una versión nueva — Actualizar». Nunca se
  recarga sola en medio de algo.
- **Se siente app**: sin rebote al deslizar ni resaltado gris al tocar, y la
  cabecera respeta el notch del iPhone.

## Cómo está hecho

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Manifiesto | `public/manifest.webmanifest` | Nombre, íconos (normal y *maskable*), colores, atajos y capturas que Android muestra al instalar (`public/screenshots/`). |
| Service worker | `public/sw.js` | Precarga del build, caché de fotos, navegación sin conexión, push y la espera de la versión nueva. |
| Plugin de build | `vite.config.ts` → `pwaPlugin`, `scripts/pwa.mjs` | Escribe en `dist/sw.js` la lista de archivos del build y una `VERSION` con su huella; publica `/.well-known/assetlinks.json` si hay datos de Play Store. |
| Plataforma | `src/services/pwa/platform.ts` | ¿iPhone, Android o computador? ¿Abierta desde el ícono? |
| Instalación | `src/services/pwa/install.ts` | Guarda el evento `beforeinstallprompt` (se escucha en `main.tsx` antes de pintar React) y abre el diálogo del sistema al tocar «Instalar». |
| Actualizaciones | `src/services/pwa/serviceWorker.ts` | Registra `sw.js`, detecta la versión nueva, busca actualizaciones al volver a la app y recarga cuando la persona lo pide. |
| Pantallas | `src/features/install/` | Página `/app`, aviso del celular, tarjeta de **Mi cuenta** y avisos de versión nueva / sin conexión. |

Detalles que importan:

- **Precarga**: sólo `assets/*.js|css|woff2|…` del build (≈1,4 MB, ≈400 KB
  comprimido). Las fotos de la página no se precargan; se guardan al verlas.
- **`ignoreVary`**: el navegador pide los módulos con la cabecera `Origin` y
  algunos servidores responden con `Vary: Origin`; sin esa opción la caché
  nunca coincidiría y la app no abriría sin conexión.
- **Primera instalación vs. actualización**: la primera vez el service worker
  toma el control enseguida (`skipWaiting`); las siguientes espera al mensaje
  `SKIP_WAITING` que manda el botón «Actualizar».
- **Privacidad**: los datos de Supabase (consultas, sesión) nunca se guardan
  en la caché del service worker; sólo el código y las fotos firmadas, que se
  borran al cerrar sesión.
- **Cabeceras**: `sw.js` y el manifiesto van con `Cache-Control: no-cache`
  para que una versión nueva se note enseguida (`public/_headers` y
  `vercel.json`).

## Publicarla en Google Play (opcional)

No hace falta para instalarla, pero si quieres que aparezca en Play Store se
empaqueta la misma web como **Trusted Web Activity** (TWA): una app Android
mínima que abre el sitio a pantalla completa, sin barra de Chrome, con los
avisos y todo lo demás funcionando igual.

Lo que necesitas tú:

1. Una cuenta de **Google Play Console** (pago único de 25 USD).
2. Generar el paquete con [PWABuilder](https://www.pwabuilder.com/): pega la
   URL del sitio → *Package for stores* → **Android**. Elige un *package ID*
   (por ejemplo `app.netlify.camila_sanchez.twa`) y descarga el `.aab` y la
   llave de firma (guárdala bien: sin ella no podrás publicar actualizaciones).
   Alternativa por consola: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   (`npx @bubblewrap/cli init --manifest https://<tu-sitio>/manifest.webmanifest`).
3. En **Netlify → Site configuration → Environment variables** agrega:

   | Variable | Valor |
   | --- | --- |
   | `ANDROID_PACKAGE_NAME` | El *package ID* del paso 2. |
   | `ANDROID_CERT_SHA256` | La huella SHA-256 de la llave (`AA:BB:…`). Si usas *Play App Signing*, agrega también la huella que muestra Play Console (*Integridad de la app*), separadas por coma. |

   En el siguiente despliegue el build publica
   `https://<tu-sitio>/.well-known/assetlinks.json`. Ese archivo es la prueba
   para Google de que la app y el sitio son tuyos; sin él, la app mostraría
   una barra de dirección arriba. Si las variables faltan, el archivo no se
   publica; si tienen un formato inválido, el build se detiene con el error.
4. Sube el `.aab` a Play Console, completa la ficha (puedes usar las
   capturas de `public/screenshots/`) y la política de privacidad
   (`https://<tu-sitio>/legal/privacidad`).

Las actualizaciones de la app **no** requieren subir nada nuevo a Play Store:
la TWA siempre carga el sitio publicado.

## ¿Y en la App Store?

Apple no acepta apps que sólo envuelven una web, y publicar exige una cuenta
de desarrollador (99 USD al año) y un Mac para compilar. Para una app privada
de pareja no compensa: en iPhone la app se instala desde Safari con
«Agregar a inicio» y funciona igual (ícono, pantalla completa, avisos y sin
conexión). Si algún día se quisiera, el camino sería empaquetarla con
[Capacitor](https://capacitorjs.com/) y añadir algo propio de iOS.

## Probarlo

```bash
npm run build && npm run preview   # http://localhost:4173
```

- En Chrome: DevTools → **Application** → *Manifest* (sin errores de
  instalación) y *Service workers*; en *Network* marca **Offline** y recarga.
- En el celular, en la misma red: `npm run preview -- --host` y abre la IP
  que muestra (la instalación real exige HTTPS, así que pruébala en el sitio
  publicado o en el *deploy preview* de Netlify).
- Pruebas automáticas: `scripts/pwa.test.ts` (precarga, versión,
  assetlinks y manifiesto) y `src/services/pwa/platform.test.ts`.
