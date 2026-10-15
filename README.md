# Camila 💖 · v2

Página de recuerdos para Camila, con panel de contenido para ella, panel de
super administrador, cajita de mensajes, chat en tiempo real, fechas con cuenta
regresiva y subida de fotos que se optimizan solas.

> La versión original (HTML/JS estático) quedó en [`legacy/`](legacy/README.md)
> con sus errores corregidos.

## Probarlo ya (modo demo, sin cuentas)

```bash
npm install
npm run dev
```

Sin variables de entorno la app arranca en **modo demo**: todo se guarda en el
navegador (localStorage + IndexedDB) y dos pestañas se hablan entre sí, así
que puedes probar el chat y las notificaciones abriendo dos ventanas.

| Cuenta demo | Contraseña | Rol |
| --- | --- | --- |
| `juan@demo.local` | `demo1234` | Super administrador |
| `camila@demo.local` | `demo1234` | Editora (panel de contenido) |

## Qué incluye

| Área | Ruta | Quién |
| --- | --- | --- |
| Página principal (portada, contador juntos, cuentas regresivas, notas, hitos, galería por año/mes, carta, frases) | `/` | Quien tenga `site.view` (o todos si el sitio es público) |
| Cajita de mensajes | `/mensajes` | `notes.send` |
| Chat en tiempo real | `/chat` | `chat.use` |
| Panel de contenido: fotos, textos y animaciones, hitos, fechas importantes, sorpresas/interrupciones, paleta de colores (por defecto la rosa suave de la versión 1) | `/panel` | Editora y super admin |
| Super admin: usuarios, roles y permisos, apariencia (colores, fuentes, efectos, música), secciones, ajustes, auditoría | `/super` | Super admin |

**Fotos:** cada imagen se procesa en un *pool* de Web Workers (OffscreenCanvas):
se corrige la orientación EXIF, se quitan metadatos (GPS incluido), se reduce
a máx. 2048 px con escalado progresivo y se codifica en WebP (JPEG si el
navegador no puede) bajando la calidad poco a poco hasta ~450 KB sin pasar de
0.68. También se genera una miniatura de 480 px. Una cola con concurrencia 2,
reintentos con *backoff* y cancelación sube los archivos mientras se muestra el
cargador romántico (corazón que late, anillo de progreso, frases y bytes
ahorrados).

**Carga masiva:** se pueden elegir muchas fotos, una carpeta entera o
arrastrar carpetas con subcarpetas (hasta 1000 fotos por tanda). Cada foto
se ubica sola en el mes en que se tomó (fecha EXIF de la cámara), las
repetidas se saltan gracias a una huella SHA-256, la pantalla no se apaga
mientras sube y al final un resumen permite reintentar las que fallaron.

## Arquitectura

```
src/
  core/       config, validación, errores, EventBus
  domain/     tipos, permisos (RBAC), fechas y cuentas regresivas, valores por defecto
  data/       puerto Backend + adaptadores (Supabase | demo), elegido por una fábrica
  services/   cola de tareas, pipeline de imágenes (workers), notificaciones
  state/      contextos: backend, auth, contenido (store observable), tema, notificaciones
  ui/         componentes reutilizables (modal, campos, toasts, cargador romántico)
  features/   site · auth · admin (panel) · super · messages · chat
              (cada una con sus estilos en features/<x>/styles)
  styles/     sistema de diseño en SCSS: abstracts · base · components · layout
supabase/
  migrations/ esquema, RLS, triggers de auditoría y notificaciones, bucket privado
  functions/  admin-users (gestión de cuentas) · send-push (Web Push)
  tests/      pruebas de RLS sobre PGlite
```

- **Puertos y adaptadores (hexagonal):** la UI sólo conoce la interfaz
  `Backend` (`src/data/ports.ts`). Supabase y el modo demo son dos
  implementaciones intercambiables.
- **Registry/Strategy:** cada tipo de sección tiene su renderizador y su editor
  registrados; agregar un tipo nuevo no toca el resto.
- **Observer:** `SiteContentStore` (con `useSyncExternalStore`) se refresca por
  colección cuando llega un cambio en tiempo real.
- **Fachada:** `PhotoUploader` orquesta workers + cola + almacenamiento.

**Por qué Supabase:** da Postgres con Row Level Security, autenticación,
almacenamiento privado con URLs firmadas, tiempo real y funciones en el borde
en un solo servicio con plan gratuito. La seguridad vive en la base de datos,
no en el navegador.

### Estilos (SCSS)

Los estilos están en SCSS con el sistema de módulos de Sass (`@use`/`@forward`):

```
src/styles/
  abstracts/   variables (breakpoints, espacios, capas z-index), funciones y mixins; no generan CSS
  base/        tokens del tema como custom properties, reset, tipografía, utilidades, animaciones
  components/  botones, formularios, tarjetas, insignias, modal, toasts, pestañas (BEM)
  layout/      cabecera, campana de notificaciones, pantallas de acceso, banner
  main.scss    hoja global
src/features/site/styles/      un parcial por sección de la página (hero, galería, hitos...)
src/features/admin/styles/     estructura de los paneles, listas, fotos, editor de tema
src/features/messages/styles/  cajita de mensajes y chat
*.module.scss                  CSS Modules para componentes aislados (cargador, resumen de carga)
```

- Cualquier archivo puede hacer `@use "abstracts" as *;` para usar `space(4)`,
  `z("modal")`, `@include below("md")`, `@include surface`, etc.
- Los estilos de cada funcionalidad se cargan con su ruta: quien sólo ve la
  página no descarga los del panel.
- Los colores siguen siendo custom properties para que el super admin los
  cambie en vivo desde *Apariencia*.

### SEO

- Título, descripción, `robots`, URL canónica, Open Graph, Twitter Card y datos
  estructurados (JSON-LD `WebSite`) por ruta (`src/core/seo.ts`).
- La portada sólo se indexa si el sitio es público (*Super admin → Ajustes*);
  entrar, paneles, cajita, chat y páginas inexistentes son siempre `noindex`,
  también con la cabecera `X-Robots-Tag`.
- El build genera `robots.txt` y `sitemap.xml` con `VITE_SITE_URL`, y deja en
  `index.html` la imagen para compartir (`public/og-image.jpg`, 1200×630, sin
  fotos personales) en URL absoluta para que WhatsApp o Facebook muestren la
  vista previa.
- `VITE_SEO_INDEX=false` apaga la indexación por completo.

### Seguridad

- Toda tabla tiene RLS; los permisos se resuelven en SQL (`has_permission`).
- Triggers impiden escalar privilegios y borrar o degradar al último super admin.
- Registro público desactivado: sólo el super admin crea cuentas.
- Las notificaciones y la auditoría sólo las escriben triggers.
- Fotos nuevas en un bucket **privado** (5 MB, sólo imágenes) servidas con URLs firmadas.
- CSP y cabeceras de seguridad en producción (`vercel.json`, `public/_headers`).
- La `service_role` key sólo existe dentro de las Edge Functions.

## Puesta en marcha real (pasos que debes hacer tú)

Ningún secreto va en el repositorio: las claves sólo se pegan en los paneles de
Supabase y Netlify. No hace falta instalar nada en tu computador.

### 1. Base de datos (Supabase, plan gratuito)

1. En [supabase.com](https://supabase.com) → *New project*. Nombre libre,
   una contraseña de base de datos fuerte (guárdala tú) y región cercana
   (p. ej. *South America (São Paulo)*).
2. *SQL Editor* → *New query* → pega **todo** `supabase/setup.sql` → *Run*.
   Crea tablas, permisos, seguridad (RLS), el bucket privado de fotos y el
   contenido de la versión 1. Se ejecuta una sola vez.
3. *Authentication → Sign In / Providers → Email*: desactiva
   *Allow new users to sign up* (sólo tú creas cuentas).
4. *Authentication → Users → Add user → Create new user*: crea tu cuenta y la
   de Camila con su correo y una contraseña, marcando *Auto Confirm User*.
5. *SQL Editor* → pega `supabase/roles.sql`, cambia `CORREO_DE_JUAN` y
   `CORREO_DE_CAMILA` por los correos reales (sólo ahí, no en el repo) →
   *Run*. Quedas como **super administrador**, Camila como **editora** y la
   página queda **pública** (cambia `sitio_publico` a `false` si prefieres que
   sólo entren personas con cuenta; también se cambia luego en
   *Super admin → Ajustes*).
6. *Project Settings → API*: copia la **Project URL** y la clave **anon
   public**. La anon key es pública por diseño; la `service_role` **nunca** se
   pone en la web.

### 2. Web (Netlify)

1. *Site configuration → Build & deploy*: el repositorio ya trae
   `netlify.toml` (compila con `npm run build` y publica `dist/`), así que no
   hay que llenar nada. La rama de producción es `master`.
2. *Site configuration → Environment variables* → agrega:

   | Variable | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | la Project URL |
   | `VITE_SUPABASE_ANON_KEY` | la clave anon public |
   | `VITE_SITE_URL` | tu dominio sin `/` final, p. ej. `https://camila-sanchez.netlify.app` |
   | `VITE_SEO_INDEX` | `true` (o `false` si no quieres aparecer en Google) |

3. *Deploys → Trigger deploy → Deploy site*. Sin estas variables la web
   arranca en modo demo (todo se guarda sólo en el navegador de quien la abre).

### 3. Conectar el inicio de sesión con tu dominio

En Supabase → *Authentication → URL Configuration*: pon tu dominio como
*Site URL* y agrega `https://TU-DOMINIO/**` en *Redirect URLs*.

Listo: cualquiera abre la página, y tú y Camila entran por `/entrar` con su
correo y contraseña. Tú ves *Administración* (`/super`) y ella *Mi panel*
(`/panel`).

### Opcional: invitar cuentas desde la app y notificaciones push

La página *Super admin → Usuarios* (crear o invitar cuentas desde la web) y
las notificaciones push al celular usan dos Edge Functions. Necesitan la
[CLI de Supabase](https://supabase.com/docs/guides/cli) y Node 20+:

```bash
npx supabase login
npx supabase link --project-ref TU_REF
npx web-push generate-vapid-keys        # genera la pareja de claves VAPID
npx supabase secrets set \
  ALLOWED_ORIGIN=https://TU-DOMINIO \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:TU_CORREO \
  PUSH_WEBHOOK_SECRET=$(openssl rand -hex 32)
npx supabase functions deploy admin-users
npx supabase functions deploy send-push --no-verify-jwt
```

Luego, en *Database → Webhooks → Create*: tabla `notifications`, evento
`INSERT`, tipo *Supabase Edge Function* → `send-push`, con la cabecera
`x-webhook-secret: <tu PUSH_WEBHOOK_SECRET>`; y en Netlify agrega
`VITE_VAPID_PUBLIC_KEY`. Sin esto, la cajita, el chat y la campana de
notificaciones dentro de la app funcionan igual (en tiempo real).

Si usas la CLI, `npx supabase db push` aplica las migraciones en lugar del
paso 1.2 (después ejecuta igual `seed.sql` y `roles.sql`). Si cambias una
migración, regenera el archivo único con `npm run db:setup-sql`.

### Sobre la privacidad del repositorio

Este repositorio es **público** y contiene fotos personales en
`public/assets/img`. Las fotos nuevas ya se guardan en el bucket privado de
Supabase, no en git. Te recomiendo hacer el repositorio privado (Settings →
General → Danger Zone) y, si quieres, mover también las fotos antiguas al
panel; la decisión es tuya.

## Desarrollo

```bash
npm run dev        # servidor local (modo demo si no hay .env.local)
npm run check      # typecheck + lint + pruebas
npm run build      # compilación de producción
```

Para conectar el entorno local a Supabase copia `.env.example` a `.env.local`.
La integración continua (`.github/workflows/ci.yml`) corre typecheck, lint,
pruebas (incluidas las de RLS) y build en cada push.
