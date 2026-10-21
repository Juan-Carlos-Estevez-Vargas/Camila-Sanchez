# Camila 💖 · v2

Página de recuerdos para Camila, con panel de contenido para ella, panel de
super administrador, cajita de mensajes, chat en tiempo real con fotos y
stickers, listas de cosas por hacer compartidas, avisos en el celular, colores propios para cada persona, fechas con
cuenta regresiva y subida de fotos que se optimizan solas.

> La versión original (HTML/JS estático) quedó en [`legacy/`](legacy/README.md)
> con sus errores corregidos.

## Documentación

| Documento | Para quién |
| --- | --- |
| [Manual de usuario](docs/MANUAL_DE_USUARIO.md) | Quien usa la app: visitantes, Camila y Juan |
| [Manual de arquitectura](docs/ARQUITECTURA.md) | Quien mantiene o extiende el código |
| [Diagramas](docs/DIAGRAMAS.md) | Flujos, secuencias, despliegue, modelo de datos y permisos (Mermaid) |

Dentro de la app, el botón **? Tutorial** de la cabecera hace un recorrido
guiado por la página en la que estés, según lo que tu cuenta puede usar.

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
| Chat en tiempo real tipo WhatsApp: fotos, stickers, responder citando, última conexión y vistos (✓ ✓✓) | `/chat` | `chat.use` |
| Perfil propio: nombre, foto o icono, frase y cumpleaños; se ve en la cabecera, el chat y las listas | `/cuenta/perfil` | Cualquier cuenta |
| Listas compartidas: eliges con quién (dos o un grupo) y agregan tareas con subtareas, descripción, materiales, fotos, fecha y responsable, en vivo | `/listas` | `lists.use` |
| Panel de contenido: fotos, textos y animaciones, hitos, fechas importantes, sorpresas/interrupciones | `/panel` | Editora y super admin |
| Mi cuenta: avisos en este dispositivo (con prueba), contraseña y sesiones | `/cuenta` | Cualquier cuenta |
| Mis colores: cada persona elige su paleta sin cambiársela a nadie más; quien entra sin cuenta ve Rosa vino | `/cuenta/colores` | Cualquier cuenta |
| Avisos en la pantalla de notificaciones del celular: cada mensaje del chat, cada notita, cada sorpresa y lo que pasa en tus listas | — | Quien los active en su dispositivo |
| Super admin: usuarios, roles y permisos, apariencia (colores, fuentes, efectos, música), secciones, ajustes, auditoría | `/super` | Super admin |
| Tutorial guiado: botón fijo en la cabecera que recorre la página actual paso a paso | todas | Todos |

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
  domain/     tipos, permisos (RBAC), fechas, paletas, chat y stickers, listas, valores por defecto
  data/       puerto Backend + adaptadores (Supabase | demo), elegido por una fábrica
  services/   cola de tareas, pipeline de imágenes (workers), notificaciones
  state/      contextos: backend, auth, contenido (store observable), tema, notificaciones
  ui/         componentes reutilizables (modal, campos, toasts, cargador romántico)
  features/   site · auth · admin (panel) · super · messages · chat · lists · tour
              (cada una con sus estilos en features/<x>/styles)
  styles/     sistema de diseño en SCSS: abstracts · base · components · layout
supabase/
  migrations/ esquema, RLS, triggers de auditoría y avisos, buckets privados, push
  functions/  admin-users (cuentas) · redeem-invite (invitaciones) · send-push (Web Push)
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
- Los colores siguen siendo custom properties: la app pone los de la página
  (*Apariencia*) y encima los que cada persona eligió en *Mis colores*.

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
- Registro público desactivado: sólo entra quien crea el super admin o quien
  recibe un **enlace de invitación**.
- Las notificaciones y la auditoría sólo las escriben triggers.
- Fotos nuevas en buckets **privados** (5 MB, sólo imágenes) servidas con URLs firmadas;
  en el chat cada persona sólo sube a su propia carpeta y en las listas sólo
  los miembros de cada lista ven y suben sus fotos.
- Los avisos al celular se envían con un secreto guardado en Supabase Vault;
  cada dispositivo pertenece a una sola cuenta y se da de baja al cerrar sesión.
- La `service_role` key sólo existe dentro de las Edge Functions.

**Invitaciones por enlace o QR** (*Administración → Usuarios → Crear enlace*):
el token tiene 256 bits al azar, se genera en el navegador de quien invita y
en la base sólo se guarda su SHA-256. Viaja en el `#fragmento` de la URL (los
navegadores no lo mandan a ningún servidor ni queda en registros) y la página
lo borra de la barra de direcciones al abrirla. Es de un solo uso (se consume
de forma atómica en la función `redeem-invite`), vence en 24 h a 7 días, se
puede revocar y nunca puede crear un super administrador.

**Sesiones y cookies:**

- La app no usa cookies. Supabase Auth guarda la sesión en el navegador: con
  *Mantener la sesión iniciada* en `localStorage`; sin ella, en
  `sessionStorage`, y se borra al cerrar la pestaña (para equipos compartidos).
- Tokens de acceso de 1 hora con **rotación de tokens de refresco**: un token
  robado deja de servir en cuanto se usa el legítimo. Contraseñas de 10+
  caracteres. Todo esto lo aplica el flujo `Deploy` en Supabase.
- Al abrir la app la sesión se confirma con el servidor: si se revocó, se
  descarta.
- *Mi cuenta* permite cambiar la contraseña y **cerrar sesión en todos los
  dispositivos** (revoca los tokens de refresco de todos lados).
- **Recuperar contraseña** (`/recuperar`): el enlace lleva un token de un solo
  uso que vence en 1 hora, viaja en el `#fragmento` (no queda en registros) y
  se borra de la barra al abrirlo. Al guardar la contraseña nueva se cierran
  las sesiones de los demás dispositivos. El formulario responde igual exista
  o no el correo, para no revelar qué cuentas hay.
- Inicio de sesión con PKCE y sin redirecciones abiertas (`?next=` sólo acepta
  rutas internas).
- Cabeceras en producción (`public/_headers` y `vercel.json`, iguales y
  vigiladas por una prueba): **Content-Security-Policy** estricta (sólo
  scripts del propio sitio, conexiones sólo a Supabase, sin iframes), HSTS,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y
  `Cross-Origin-Opener-Policy`. La CSP es lo que protege el token guardado en
  el navegador frente a scripts inyectados.

## Puesta en marcha real (pasos que debes hacer tú)

Ningún secreto va en el repositorio: las claves sólo se pegan en los paneles
de Supabase, GitHub y Netlify. No hace falta instalar nada en tu computador.
Después de esto, **cada merge a `main` o `master` se despliega solo**:
Netlify vuelve a publicar la web y el flujo
[`Deploy`](.github/workflows/deploy.yml) aplica las migraciones nuevas, ajusta
el inicio de sesión, publica las Edge Functions y deja listos los avisos al
celular.

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
   cuenta con tu correo y una contraseña, marcando *Auto Confirm User*.
2. *SQL Editor* → pega `supabase/cuentas.sql`, cambia `CORREO_DE_JUAN` por tu
   correo (sólo ahí, no en el repo) y deja `CORREO_DE_CAMILA` vacío si
   todavía no tiene cuenta → *Run*. Quedas como **super administrador** y la
   página queda **pública** (cambia `sitio_publico` a `false` si prefieres que
   sólo entren personas con cuenta; también se cambia luego en
   *Super admin → Ajustes*).
3. Para Camila no necesitas su correo: entra a la página, ve a
   *Administración → Usuarios → Crear enlace* y mándale el enlace o muéstrale
   el código QR. Ella elige su nombre, correo y contraseña y entra como
   **Editora**.

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

### Versiones y releases

Cada despliegue termina creando un release `vX.Y.Z` en la pestaña *Releases*
de GitHub, con las notas de lo que cambió agrupadas por tipo. La versión sigue
[SemVer](https://semver.org/lang/es/) según los mensajes de commit desde el
release anterior:

| Commits desde el último release            | Ejemplo         |
| ------------------------------------------- | --------------- |
| `feat!:` o `BREAKING CHANGE` en el cuerpo   | 2.4.1 → 3.0.0   |
| Algún `feat:`                               | 2.4.1 → 2.5.0   |
| Sólo `fix:`, `docs:`, `ci:`, etc.           | 2.4.1 → 2.4.2   |

El primer release toma la versión de `package.json` (2.0.0). Para forzar un
salto, sube la versión en `package.json`. `npm run release:preview` muestra en
local la versión y las notas que saldrían.

### Recuperar contraseña

Hay dos caminos, y el primero funciona desde ya:

- **Enlace o QR desde el panel.** En *Administración → Usuarios*, el botón 🔑
  de cada persona crea un enlace para que elija una contraseña nueva. No usa
  el correo: se lo muestras o se lo mandas tú. Sirve una vez y dura 1 hora.
- **"Olvidé mi contraseña" en `/entrar`.** Envía un correo con el enlace.
  Supabase, con su correo por defecto, sólo envía a los miembros de tu equipo
  de Supabase (o sea, a ti) y limita a unos pocos correos por hora. Para que le
  llegue a Camila, conecta un correo propio, por ejemplo Gmail:
  1. En tu cuenta de Google activa la verificación en dos pasos y crea una
     *contraseña de aplicación* en <https://myaccount.google.com/apppasswords>.
  2. En GitHub, *Settings → Secrets and variables → Actions → New repository
     secret*, crea:
     `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `465`,
     `SMTP_USER` = tu Gmail, `SMTP_PASS` = la contraseña de aplicación
     (16 letras, sin espacios) y, si quieres, `SMTP_SENDER_EMAIL`.
  3. Vuelve a ejecutar el flujo *Deploy* (pestaña *Actions → Deploy → Run
     workflow*). Desde ahí los correos salen de tu Gmail con una plantilla
     bonita (`supabase/templates/recovery.html`) y el enlace funciona aunque se
     abra en otro celular.

### Avisos en la pantalla de notificaciones del celular

No hay que configurar nada: el flujo *Deploy* crea una sola vez las claves
de Web Push, las guarda como secretos de Supabase, publica `send-push` y
conecta la base de datos con ella (Supabase Vault + `pg_net`). Si prefieres
tus propias claves, crea los secrets de GitHub `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `PUSH_WEBHOOK_SECRET` y vuelve a correr
*Deploy*.

Lo único que hace cada persona, en cada celular: **Mi cuenta → Avisos en este
dispositivo → Activar avisos** (y **Enviar aviso de prueba** para comprobar).
En iPhone (iOS 16.4 o más nuevo) primero hay que abrir la página en Safari,
tocar **Compartir → Agregar a inicio** y activar los avisos desde la app que
queda en la pantalla de inicio.

Llegan avisos de: cada mensaje del chat, cada notita de la cajita, cada
sorpresa que se publica ya activa y lo que pasa en tus listas. Si antes creaste a mano un *Database
Webhook* hacia `send-push`, bórralo (Supabase → *Database → Webhooks*) para
no recibir cada aviso dos veces.

### Sin GitHub Actions

Si prefieres no usar el flujo `Deploy`, pega `supabase/setup.sql` (todas las
migraciones y el contenido inicial en un solo archivo) en el *SQL Editor* en
lugar del paso 2, y configura a mano *Authentication → URL Configuration* y
*Sign In / Providers → Allow new users to sign up* (apagado). No mezcles las
dos formas en el mismo proyecto: el flujo no sabría que las migraciones ya
están aplicadas. Sin el flujo, los avisos al celular no quedan configurados:
habría que publicar `send-push` con sus secretos y crear en Vault
`push_function_url` y `push_webhook_secret` a mano. Si cambias una migración, regenera el archivo con
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
