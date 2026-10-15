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

Ningún secreto va en el repositorio: las claves sólo se pegan en los paneles
de Supabase, GitHub y Netlify. No hace falta instalar nada en tu computador.
Después de esto, **cada merge a `main` o `master` se despliega solo**:
Netlify vuelve a publicar la web y el flujo
[`Deploy`](.github/workflows/deploy.yml) aplica las migraciones nuevas, ajusta
el inicio de sesión y publica las Edge Functions.

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) con
   *Continue with GitHub*.
2. *New project*: nombre `camila-sanchez`, una contraseña de base de datos
   fuerte (*Generate a password*; **guárdala**, la usarás en el paso 2) y
   región cercana (p. ej. *South America (São Paulo)*). Plan *Free*.
3. Cuando termine de crearse, el identificador del proyecto (*project ref*)
   es el código de la URL: `supabase.com/dashboard/project/<ESTE-CÓDIGO>`.

### 2. Conectar GitHub Actions con Supabase (una vez)

1. En [Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
   → *Generate new token* (nombre `github-actions`) y cópialo.
2. En GitHub → este repositorio → *Settings → Secrets and variables →
   Actions*:
   - Pestaña **Secrets** → *New repository secret*:
     `SUPABASE_ACCESS_TOKEN` (el token) y `SUPABASE_DB_PASSWORD` (la
     contraseña de la base de datos).
   - Pestaña **Variables** → *New repository variable*:
     `SUPABASE_PROJECT_REF` (el código del paso 1.3) y `SITE_URL` (tu dominio
     sin `/` final, p. ej. `https://camila-sanchez.netlify.app`).
3. *Actions → Deploy → Run workflow*. La primera vez crea toda la base de
   datos con el contenido de la versión 1, cierra el registro público,
   configura las URLs de inicio de sesión y publica las funciones.

### 3. Cuentas de Juan y Camila

1. Supabase → *Authentication → Users → Add user → Create new user*: crea tu
   cuenta y la de Camila con su correo y una contraseña, marcando
   *Auto Confirm User*. Las contraseñas las eligen ustedes; no se las des a
   nadie.
2. *SQL Editor* → pega `supabase/cuentas.sql`, cambia `CORREO_DE_JUAN` y
   `CORREO_DE_CAMILA` por los correos reales (sólo ahí, no en el repo) →
   *Run*. Quedas como **super administrador**, Camila como **editora** y la
   página queda **pública** (cambia `sitio_publico` a `false` si prefieres que
   sólo entren personas con cuenta; también se cambia luego en
   *Super admin → Ajustes*).

### 4. Conectar la web (Netlify)

1. Supabase → *Project Settings → API*: copia la **Project URL** y la clave
   **anon public**. La anon key es pública por diseño; la `service_role`
   **nunca** se pone en la web.
2. Netlify → *Site configuration → Environment variables* → agrega:

   | Variable | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | la Project URL |
   | `VITE_SUPABASE_ANON_KEY` | la clave anon public |
   | `VITE_SITE_URL` | el mismo dominio que `SITE_URL` |
   | `VITE_SEO_INDEX` | `true` (o `false` si no quieres aparecer en Google) |

3. *Deploys → Trigger deploy → Deploy site*. El repositorio ya trae
   `netlify.toml` (compila con `npm run build` y publica `dist/`) y la rama de
   producción es `master`. Sin estas variables la web arranca en modo demo
   (todo se guarda sólo en el navegador de quien la abre).

Listo: cualquiera abre la página, y tú y Camila entran por `/entrar` con su
correo y contraseña. Tú ves *Administración* (`/super`) y ella *Mi panel*
(`/panel`).

### Opcional: notificaciones push al celular

La cajita, el chat y la campana funcionan en tiempo real sin esto. Para que
además lleguen avisos al celular con la app cerrada:

1. Genera las claves VAPID con `npx web-push generate-vapid-keys` y un
   secreto largo al azar (`openssl rand -hex 32`).
2. Agrégalos como secrets de GitHub: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT` (`mailto:tu-correo`) y `PUSH_WEBHOOK_SECRET`; y en Netlify
   `VITE_VAPID_PUBLIC_KEY`. Vuelve a correr *Deploy*.
3. Supabase → *Database → Webhooks → Create*: tabla `notifications`, evento
   `INSERT`, tipo *Supabase Edge Function* → `send-push`, con la cabecera
   `x-webhook-secret: <tu PUSH_WEBHOOK_SECRET>`.

### Sin GitHub Actions

Si prefieres no usar el flujo `Deploy`, pega `supabase/setup.sql` (todas las
migraciones y el contenido inicial en un solo archivo) en el *SQL Editor* en
lugar del paso 2, y configura a mano *Authentication → URL Configuration* y
*Sign In / Providers → Allow new users to sign up* (apagado). No mezcles las
dos formas en el mismo proyecto: el flujo no sabría que las migraciones ya
están aplicadas. Si cambias una migración, regenera el archivo con
`npm run db:setup-sql`.

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
