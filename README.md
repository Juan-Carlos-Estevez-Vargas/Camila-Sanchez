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
| Panel de contenido: fotos, textos y animaciones, hitos, fechas importantes, sorpresas/interrupciones | `/panel` | Editora y super admin |
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

### Seguridad

- Toda tabla tiene RLS; los permisos se resuelven en SQL (`has_permission`).
- Triggers impiden escalar privilegios y borrar o degradar al último super admin.
- Registro público desactivado: sólo el super admin crea cuentas.
- Las notificaciones y la auditoría sólo las escriben triggers.
- Fotos nuevas en un bucket **privado** (5 MB, sólo imágenes) servidas con URLs firmadas.
- CSP y cabeceras de seguridad en producción (`vercel.json`, `public/_headers`).
- La `service_role` key sólo existe dentro de las Edge Functions.

## Puesta en marcha real (pasos que debes hacer tú)

Ningún secreto va en el repositorio. Necesitas Node 20+ y la
[CLI de Supabase](https://supabase.com/docs/guides/cli).

1. **Crear el proyecto** en [supabase.com](https://supabase.com) (región cercana, p. ej. São Paulo).
2. **Aplicar migraciones y datos iniciales:**
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_REF
   npx supabase db push
   ```
   Luego pega el contenido de `supabase/seed.sql` en el SQL Editor y ejecútalo.
3. **Crear tu usuario:** en *Authentication → Users → Add user* crea tu correo
   con contraseña. Después, en el SQL Editor:
   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'TU_CORREO');
   ```
4. **Desplegar las funciones y sus secretos:**
   ```bash
   npx web-push generate-vapid-keys        # genera la pareja de claves VAPID
   npx supabase secrets set \
     ALLOWED_ORIGIN=https://TU-DOMINIO \
     VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:TU_CORREO \
     PUSH_WEBHOOK_SECRET=$(openssl rand -hex 32)
   npx supabase functions deploy admin-users
   npx supabase functions deploy send-push --no-verify-jwt
   ```
5. **Webhook de notificaciones push:** *Database → Webhooks → Create*, tabla
   `notifications`, evento `INSERT`, tipo *Supabase Edge Function* →
   `send-push`, con la cabecera `x-webhook-secret: <tu PUSH_WEBHOOK_SECRET>`.
6. **Publicar la web** en Vercel o Netlify (ya están `vercel.json` y
   `public/_headers`/`_redirects`). Variables de entorno:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API) y
   `VITE_VAPID_PUBLIC_KEY`.
7. **URLs de autenticación:** en *Authentication → URL Configuration* pon tu
   dominio como *Site URL* y agrega `https://TU-DOMINIO/**` en *Redirect URLs*.
8. **Cuenta de Camila:** entra a `/super/usuarios`, invítala por correo con el
   rol *Editora*. Desde `/super/ajustes` decides si la página es pública o sólo
   para personas con cuenta, y en *Fechas importantes* pones la fecha real de
   su cumpleaños (quedó un marcador oculto).

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
