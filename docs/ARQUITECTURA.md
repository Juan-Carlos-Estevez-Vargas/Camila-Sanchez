# Manual de arquitectura

Este documento explica cómo está construida la app, por qué se tomó cada
decisión y dónde tocar para cambiar algo. Los diagramas están en
[DIAGRAMAS.md](DIAGRAMAS.md) y el uso diario en
[MANUAL_DE_USUARIO.md](MANUAL_DE_USUARIO.md).

## 1. Visión general

Es una aplicación web de una sola página (SPA) que se sirve como archivos
estáticos desde Netlify y habla directamente con Supabase. No hay un servidor
propio: la lógica de seguridad vive en la base de datos (Row Level Security y
triggers) y las pocas operaciones que necesitan privilegios de administrador
corren en Edge Functions.

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Interfaz | React 19, TypeScript estricto, React Router 7 | Pantallas, navegación y estado de la sesión |
| Estilos | SCSS con módulos de Sass y CSS Modules | Sistema de diseño, temas en vivo |
| Datos en el navegador | Puerto `Backend` con dos adaptadores (Supabase y demo) | Aislar la UI del proveedor |
| Autenticación | Supabase Auth (PKCE, rotación de tokens) | Sesiones, enlaces mágicos y recuperación |
| Base de datos | Postgres con RLS, RBAC en SQL y auditoría por triggers | Reglas de negocio y permisos |
| Archivos | Supabase Storage, buckets privados `photos`, `chat-media`, `list-media` y `avatars` | Fotos de la página, del chat, de las listas y de perfil servidas con URLs firmadas |
| Tiempo real | Supabase Realtime | Chat, listas, notificaciones y contenido que se actualiza solo |
| Avisos al celular | Web Push (VAPID), service worker, `pg_net` y Supabase Vault | Notificaciones en la pantalla del dispositivo con la app cerrada |
| Funciones | Edge Functions en Deno | Gestión de cuentas, invitaciones y Web Push |
| Publicación | Netlify (web) y GitHub Actions (backend y releases) | Despliegue continuo en cada merge |

## 2. Estructura del repositorio

```
src/
  app/        armazón: rutas, cabecera, pie de página, manejo de errores
  core/       configuración, validación, errores, EventBus, SEO, autor
  domain/     reglas puras: tipos, permisos, fechas, invitaciones, recuperación, paletas, chat, stickers
  data/       puertos (ports.ts) y adaptadores: supabase/ y demo/
  services/   cola de tareas, pipeline de imágenes (Web Workers), notificaciones, <head>
  state/      contextos de React: backend, auth, contenido, tema, notificaciones, toasts
  ui/         componentes reutilizables: modal, campos, feedback, avatar, cargador romántico
  features/   funcionalidades: site, auth, admin (panel), super, messages, chat, tour
  styles/     sistema de diseño SCSS: abstracts, base, components, layout
supabase/
  migrations/ esquema, RLS, triggers, buckets, publicación realtime y avisos push (en orden)
  functions/  admin-users, redeem-invite, send-push (+ _shared/cors.ts)
  templates/  correo de recuperación de contraseña
  tests/      pruebas de RLS sobre PGlite (Postgres en WebAssembly) con un stub de Supabase
scripts/      release.mjs (versión SemVer y notas) y build-setup-sql.mjs
docs/         estos manuales
.github/      workflows CI y Deploy
```

La regla de dependencias va de afuera hacia adentro: `features` usa `state`,
`ui`, `services` y `domain`; `domain` y `core` no importan nada de React ni de
Supabase. Eso permite probar las reglas del negocio sin navegador.

## 3. Patrones de diseño

- **Puertos y adaptadores (arquitectura hexagonal).** La UI sólo conoce la
  interfaz `Backend` de `src/data/ports.ts`, dividida en repositorios
  (`ContentRepository`, `PhotoRepository`, `MessagingRepository`,
  `UserRepository`, `InvitationRepository`, `PushRepository`) y pasarelas
  (`AuthGateway`, `RealtimeGateway`). `supabaseBackend.ts` y `demoBackend.ts`
  la implementan.
- **Factory + Strategy.** `createBackend()` (`src/data/backend.ts`) elige el
  adaptador según la configuración y lo importa de forma diferida: el modo demo
  no viaja a producción y el SDK de Supabase no se descarga en demo.
- **Observer.** `SiteContentStore` expone el contenido con
  `useSyncExternalStore` y se refresca por colección cuando llega un cambio en
  tiempo real. `EventBus` (`src/core/events.ts`) desacopla a quien produce un
  evento de quien reacciona.
- **Registry.** Cada tipo de sección de la página tiene su renderizador
  registrado en `features/site/sections/registry.tsx`; agregar uno nuevo no
  toca el resto.
- **Fachada.** `PhotoUploader` esconde la combinación de workers, cola y
  almacenamiento detrás de una sola llamada.
- **Política de acceso.** `AccessPolicy` (`src/domain/permissions.ts`) decide
  qué se muestra. La base de datos vuelve a comprobar cada operación, así que
  ocultar un botón nunca es la única protección.

## 4. Frontend

### Arranque y rutas

`main.tsx` monta `App`, que anida los proveedores en este orden:
`ToastProvider → AuthProvider → SiteContentProvider → NotificationsProvider`.
`ThemedShell` calcula el tema (el de la página con los colores de la persona
encima), monta `ThemeController`, `SeoController` y `PresenceHeartbeat` y
dibuja la cabecera, las rutas y el pie. En producción `main.tsx` registra el
service worker (`public/sw.js`): caché sin conexión y avisos push.

- Rutas públicas: `/`, `/entrar`, `/invitacion`, `/recuperar`.
- Rutas privadas (`src/app/routes.tsx`): `/mensajes`, `/chat`, `/listas`,
  `/listas/:id`, `/cuenta`, `/cuenta/perfil`, `/cuenta/colores`, `/panel/*` y `/super/*` (`/panel/colores`, de antes,
  redirige a `/cuenta/colores`). Cada una se envuelve en `RequirePermission`, que
  manda a `/entrar?next=…` si no hay sesión y muestra un aviso si falta el
  permiso.
- Todas las áreas privadas se cargan con `lazy()`: quien sólo visita la página
  nunca descarga el código de los paneles.

### Estado

| Contexto | Qué guarda |
| --- | --- |
| `BackendContext` | La instancia del adaptador elegido |
| `AuthContext` | Usuario, perfil (con sus colores), `AccessPolicy` y acciones de sesión; al cerrar sesión da de baja el push del dispositivo |
| `SiteContentStore` | Ajustes, secciones, fotos, hitos, fechas y sorpresas, más las URLs firmadas |
| `NotificationsContext` | Avisos, contador sin leer por tipo, notificaciones del sistema y renovación de la suscripción push del dispositivo |
| `ThemeController` | Aplica el tema como custom properties en `:root`: el de la página con los colores de la persona encima (`personalTheme`) |
| `ToastContext` | Mensajes emergentes |

### Fotos

1. `ImageProcessor` reparte cada archivo a un pool de Web Workers
   (`image.worker.ts`, con `OffscreenCanvas`).
2. El worker corrige la orientación EXIF, quita metadatos (GPS incluido),
   reduce a 2048 px como máximo y codifica en WebP (JPEG si no se puede) hasta
   unos 450 KB. También genera una miniatura de 480 px.
3. `TaskQueue` sube con concurrencia 2, reintentos con backoff y cancelación.
4. En la carga masiva, cada foto se ubica en el mes en que se tomó (fecha EXIF)
   y las repetidas se saltan gracias a una huella SHA-256 guardada en
   `photos.source_hash`.
5. Las fotos de perfil pasan por el mismo worker con otro tamaño (512 px,
   unos 120 KB) y van al bucket privado `avatars`, en la carpeta de cada
   persona.

### Perfil

`/cuenta/perfil` (`features/auth/ProfilePage.tsx`) guarda nombre, frase,
cumpleaños e icono con `users.updateMyProfile`, y la foto con
`users.setMyAvatar`, que sube la nueva, guarda la ruta y borra la anterior
(si algo falla, borra la recién subida). `ui/Avatar.tsx` dibuja a cualquier
persona: su foto con URL firmada, si no su icono y si no la inicial; lo usan
la cabecera, Mi cuenta, el chat y las listas. `ProfileCard` muestra el perfil
de otra persona desde el chat. `domain/profile.ts` calcula la fecha del
cumpleaños (día y mes) y los días que faltan.

### Tutorial guiado

`features/tour` tiene tres piezas:

- `tourSteps.ts`: funciones puras que, según la ruta y los permisos, devuelven
  los pasos. Sólo se enseñan las secciones que la cuenta puede usar.
- `tourLayout.ts`: geometría pura del resaltado y la tarjeta (debajo, encima,
  centrada o anclada abajo en pantallas angostas).
- `GuidedTour.tsx`: el botón **Tutorial** fijo en la cabecera y el recorrido,
  dibujado con un portal sobre `document.body`.

Los elementos que el tutorial resalta llevan un atributo `data-tour="…"`. Para
agregar un paso basta con marcar el elemento y añadir su entrada en
`tourSteps.ts`; las pruebas en `tourSteps.test.ts` comprueban que cada paso
tenga texto e id único.

### Estilos

- `src/styles/abstracts`: variables, funciones (`space()`, `z()`, `tint()`) y
  mixins; no generan CSS.
- `base`: tokens del tema como custom properties, reset, tipografía,
  utilidades y animaciones.
- `components` y `layout`: piezas BEM reutilizables y estructura.
- Cada funcionalidad carga sus estilos con su ruta (`features/*/styles`) y los
  componentes aislados usan CSS Modules.
- Las capas de `z-index` están centralizadas en `$z-layers`.
- Responsive: las cuadrículas de una columna (`.stack`, la cajita, el chat y
  las listas) usan `grid-template-columns: minmax(0, 1fr)`, así un texto
  largo de una sola línea (el resumen de una notita, un nombre) se recorta
  con «…» en vez de ensanchar la página. Los títulos y palabras largas usan
  `overflow-wrap: anywhere`.

## 5. Backend (Supabase)

### Modelo de datos

Las tablas viven en `public` y se crean con las migraciones de
`supabase/migrations` (el diagrama entidad-relación está en
[DIAGRAMAS.md](DIAGRAMAS.md#modelo-de-datos)):

- **Acceso:** `profiles` (con `theme_colors`, los colores que eligió cada
  persona, y el perfil: `avatar_path` en el bucket `avatars`, `avatar_emoji`,
  `bio` y `birthday`), `permissions`, `role_permissions`, `invitations`.
- **Contenido:** `site_settings` (fila única), `sections`, `photos`,
  `milestones`, `important_dates`, `interruptions`, `interruption_views`.
- **Mensajería:** `notes`, `chat_messages` (con `reply_to` para responder
  citando y `kind` = `text`, `image` o `sticker`), `chat_reads` (última
  conexión y hasta dónde leyó cada persona), `notifications` y
  `push_subscriptions` (un registro por dispositivo con avisos activados).
- **Listas compartidas:** `todo_lists` (nombre, icono, descripción, fecha y
  quién la creó), `todo_list_members` (con quién se comparte), `todo_items`
  (tareas; con `parent_id` son subtareas de un solo nivel, con fecha,
  responsable y quién la terminó), `todo_materials` y `todo_item_images`.
- **Trazabilidad:** `audit_log`.

### Roles y permisos (RBAC)

- Tres roles: `super_admin` (Juan), `editor` (Camila) y `viewer` (invitado).
- Los permisos (`site.view`, `photos.manage`, `chat.use`, …) están en la tabla
  `permissions` y se asignan por rol en `role_permissions`.
- **Colores:** `site_settings.theme` son los de la página (los ve quien entra
  sin cuenta) y sólo los cambia `theme.manage`. Cada persona guarda los suyos
  en `profiles.theme_colors`: la restricción `is_valid_theme_colors` sólo deja
  claves de la paleta en `#rrggbb`, y `guard_profile_changes` impide que
  alguien cambie los de otra persona, incluso el super administrador.
- **Listas:** `lists.use` (editora e invitado lo tienen) deja crear listas.
  Lo de adentro no depende de un permiso sino de ser miembro:
  `is_list_member(id)` decide qué lista, tarea, material o foto ve y cambia
  cada persona. Cualquier miembro suma a otros que tengan `lists.use`; cada
  quien puede salirse; sólo quien la creó saca a otros o la borra.
- `has_permission(p)` resuelve en SQL si la persona actual tiene un permiso;
  todas las políticas RLS la usan. El super administrador los tiene todos.
- Triggers (`guard_profile_changes`, `guard_site_settings`,
  `guard_section_changes`) impiden escalar privilegios, cambiar el propio rol o
  dejar el sitio sin super administrador.

### Triggers y automatismos

- `handle_new_user`: crea el perfil de cada usuario nuevo de Auth.
- `chat_presence(p_read)`: única forma de escribir en `chat_reads`. Guarda
  la última conexión de quien la llama y, con `p_read`, que leyó el chat hasta
  ese momento. Usa `auth.uid()`, así nadie marca vistos en nombre de otro.
- `notify_new_note`, `notify_new_chat_message` y `notify_new_interruption`:
  escriben en `notifications` cuando llega una notita, un mensaje o se
  publica una sorpresa ya activa. Sólo los triggers y `send_test_notification`
  escriben ahí. En el chat se reutiliza el aviso sin leer.
- `dispatch_push` (trigger `notifications_push`): por cada aviso nuevo o
  renovado llama a `send-push` con `pg_net`, usando la URL y el secreto
  guardados en Supabase Vault.
- `register_push_subscription(...)`: guarda el dispositivo a nombre de quien
  tiene la sesión (si era de otra cuenta, pasa a la nueva).
- `send_test_notification()`: aviso de prueba para uno mismo, uno por minuto.
- `create_todo_list(...)`: crea una lista y suma a las personas elegidas en un
  solo paso (`add_list_owner` mete siempre a quien la crea).
- `guard_todo_item`: una tarea no cambia de lista, una subtarea es de la misma
  lista y de un solo nivel, sólo se asigna a miembros, y quién y cuándo la
  terminó lo pone la base. `guard_todo_image` deja cada foto en la carpeta de
  su lista y hasta 12 por tarea.
- `notify_list_member_added` y `notify_todo_item` (vía
  `notify_list_members`): avisan al sumar a alguien, al agregar o terminar una
  tarea y al asignarla. Como en el chat, el aviso sin leer de una lista se
  actualiza en vez de sumar otro.
- `guard_profile_changes`: sólo quien tiene `users.manage` cambia roles o
  activa y desactiva cuentas, siempre queda un super administrador activo, y
  sólo cada persona cambia sus colores, foto, icono, frase y cumpleaños. La foto debe estar en `avatars/<su id>/`
  (`profiles_avatar_own_folder`).
- `audit_row`: registra en `audit_log` cada INSERT, UPDATE o DELETE de las
  tablas auditadas. Los mensajes privados no se registran.
- Publicación `supabase_realtime`: avisa al navegador de los cambios.

### Edge Functions

| Función | Quién la llama | Qué hace |
| --- | --- | --- |
| `admin-users` | Super administrador con sesión | Crear, desactivar o borrar cuentas y generar enlaces de recuperación |
| `redeem-invite` | Cualquiera con un enlace de invitación | Comprobar y canjear la invitación de forma atómica |
| `send-push` | La base de datos (trigger `notifications_push` con `pg_net`) en cada aviso nuevo; `GET` desde el navegador | Enviar Web Push a los dispositivos suscritos; entregar la clave pública VAPID |

La `service_role` key sólo existe dentro de estas funciones; nunca llega al
navegador ni al repositorio.

## 6. Seguridad

| Amenaza | Defensa |
| --- | --- |
| Alguien lee o cambia datos ajenos | RLS en todas las tablas con `has_permission` |
| Alguien se da más permisos | Triggers que bloquean cambios de rol y protegen al último super admin |
| Robo del token de sesión por un script inyectado | CSP estricta (sólo scripts propios, conexiones sólo a Supabase), sin `eval` ni iframes |
| Token de sesión robado y reutilizado | Tokens de 1 hora con rotación de tokens de refresco y cierre en todos los dispositivos |
| Enlaces de invitación o recuperación filtrados | Token aleatorio de un solo uso en el `#fragmento`, que no llega a servidores ni registros; en la base sólo se guarda su SHA-256; caducan |
| Redirecciones abiertas | `?next=` sólo acepta rutas internas (`safeRedirect.ts`) |
| Fotos expuestas | Buckets privados, sólo imágenes de hasta 5 MB, URLs firmadas, metadatos borrados al subir |
| Alguien sube o borra fotos del chat de otro | En `chat-media` cada persona sólo escribe y borra en su carpeta (`<user_id>/`), y un mensaje sólo puede apuntar a fotos de esa carpeta |
| Avisos falsos o push a dispositivos ajenos | Sólo triggers crean avisos; `send-push` exige un secreto que vive en Vault y en los secretos de la función, nunca en el repositorio; cada dispositivo pertenece a una sola cuenta y se da de baja al cerrar sesión |
| Alguien ve o cambia una lista ajena | RLS con `is_list_member` en las cinco tablas; las fotos van en `list-media/<list_id>/` y el bucket sólo deja ver, subir y borrar a los miembros de esa lista |
| Perfil ajeno | El trigger `guard_profile_changes` sólo deja que cada persona cambie su foto, icono, frase y cumpleaños; las fotos van en `avatars/<user_id>/` (2 MB) y sólo su dueña o dueño sube o borra ahí |
| Colores ajenos | `profiles.theme_colors` sólo lo cambia su dueña o dueño y sólo acepta colores `#rrggbb` |
| Clickjacking y fugas de referer | `X-Frame-Options`, `frame-ancestors 'none'`, `Referrer-Policy` |
| Enumeración de cuentas | La recuperación responde igual exista o no el correo |

Las cabeceras están en `public/_headers` (Netlify) y `vercel.json`; una prueba
(`securityHeaders.test.ts`) comprueba que coincidan.

## 7. Tiempo real y notificaciones

### Chat tipo WhatsApp

- **Última conexión:** `PresenceHeartbeat` llama a `chat_presence()` cada
  30 s mientras la app está abierta y visible. Si el último latido tiene menos
  de 75 s, la otra persona ve «en línea»; si no, «últ. vez…».
- **Vistos:** al abrir el chat (y cada vez que llega algo con el chat a la
  vista) se llama `chat_presence(true)`. Un mensaje propio está *visto* si
  alguien leyó después de su hora, *entregado* si alguien se conectó después y
  *enviado* si no. Las reglas son funciones puras en `src/domain/chat.ts`.
- **Respuestas:** `chat_messages.reply_to` apunta al mensaje citado; la
  consulta lo trae embebido (`reply:reply_to(...)`). Si el original se borra,
  la respuesta pierde la cita (`on delete set null`).
- **Fotos:** el navegador las achica (borde máximo 1600 px, ~350 KB, WebP o
  JPEG sin metadatos) con el mismo `ImageProcessor` del panel, sube la foto y
  su miniatura a `chat-media/<user_id>/<id>.webp` y luego inserta el mensaje
  con `kind = 'image'`. Si el insert falla, borra lo que subió. La
  conversación pide URLs firmadas sólo para las miniaturas, y la foto grande
  al abrir el visor.
- **Stickers:** son emoji con una frase, definidos en `src/domain/stickers.ts`;
  la base de datos sólo guarda el id (`sticker`). No hay imágenes externas.
- La restricción `chat_messages_content` exige lo de cada tipo: el texto no
  puede ir vacío, la foto necesita sus dos rutas y el sticker no lleva texto.
  El aviso de un mensaje nuevo dice «📷 Foto» o «✨ Sticker».
- `chat_reads` está en la publicación de Realtime: los vistos y la conexión se
  actualizan sin recargar.

### Listas compartidas

- `ListsPage` (`/listas`) muestra las listas de la persona con su avance y la
  fecha más cercana; `ListPage` (`/listas/:id`) la lista con sus tareas, y
  `TaskEditor` el detalle de una tarea, que se guarda solo.
- Las cinco tablas están en la publicación de Realtime: lo que hace una
  persona aparece en la pantalla de las demás sin recargar (las recargas se
  agrupan en 250 ms).
- Las reglas puras (árbol de tareas, avance, fechas) están en
  `src/domain/lists.ts` y tienen pruebas.

### Avisos

1. Una notita, un mensaje, una sorpresa o algo en una lista se inserta con RLS.
2. Un trigger crea la fila en `notifications` para la otra persona. En el
   chat, si ya hay un aviso sin leer, se actualiza con el último mensaje (la
   campana muestra uno solo, pero cada mensaje avisa al celular).
3. Realtime la entrega al navegador abierto: se actualizan la campanita y los
   contadores y aparece un toast. Si la pestaña está en segundo plano y el
   dispositivo no tiene push, se muestra una notificación del sistema.
4. El trigger `notifications_push` lee de Supabase Vault la URL de `send-push`
   y su secreto y la llama con `pg_net`. Si no están, no hace nada; si falla,
   el aviso se guarda igual. `send-push` manda el Web Push (VAPID) a los
   dispositivos de esa persona y borra las suscripciones vencidas.
5. El service worker (`public/sw.js`) muestra el aviso en la pantalla de
   notificaciones (los del chat se agrupan en uno, y los de cada lista en uno
   por lista) y abre el enlace al tocarlo.

Cada dispositivo se suscribe con `register_push_subscription`, que lo pone a
nombre de quien inició sesión por última vez en él; al cerrar sesión la
suscripción se borra. La clave pública VAPID se pide a `send-push` (`GET`), así
que no hay que configurarla en Netlify. El flujo *Deploy* genera las claves y
el secreto la primera vez y los guarda en los secretos de Supabase y en Vault.

## 8. Integración y despliegue continuos

- **CI** (`.github/workflows/ci.yml`): en cada push y pull request ejecuta
  typecheck, lint, pruebas (unitarias y de RLS sobre PGlite) y build.
- **Deploy** (`.github/workflows/deploy.yml`): en cada merge a `master`
  - vuelve a correr las pruebas,
  - aplica las migraciones nuevas en Supabase,
  - configura Auth (URLs, registro cerrado, plantilla y SMTP opcional),
  - publica las Edge Functions,
  - configura los avisos push (claves VAPID y secreto la primera vez, en los
    secretos de Supabase y en Vault),
  - y en el job `release` calcula la versión y crea el tag y el release.
- **Netlify** publica la web sola con cada merge (`netlify.toml`). El build
  trae los tags para que el pie de página muestre la misma versión que el
  release.

### Versionado

`scripts/release.mjs` sigue SemVer a partir de los mensajes de commit
(Conventional Commits) desde el último tag:

- `tipo!:` o `BREAKING CHANGE` → versión mayor;
- `feat:` → versión menor;
- cualquier otro → parche.

Un salto manual en `package.json` manda sobre el cálculo.

## 9. Pruebas

| Tipo | Dónde | Qué cubren |
| --- | --- | --- |
| Unitarias de dominio | `src/domain/*.test.ts` | Fechas, invitaciones, recuperación, paletas y colores por persona, chat (vistos, última conexión, vistas previas), stickers, listas (avance, fechas, subtareas), perfil (cumpleaños, inicial) |
| Unitarias de núcleo | `src/core/*.test.ts` | Validación, redirecciones seguras, SEO, cabeceras |
| Servicios | `src/services/**/*.test.ts` | Cola de tareas, EXIF, tamaños, carga masiva |
| Tutorial | `src/features/tour/*.test.ts` | Pasos por rol y posición de la tarjeta |
| Base de datos | `supabase/tests/rls.test.ts` | Políticas RLS, triggers, buckets, listas compartidas, perfiles y avisos push sobre PGlite (con Vault y `pg_net` simulados en `supabaseStub.ts`) |
| Releases | `scripts/release.test.ts` | Cálculo de versión y notas |

`npm run check` corre typecheck, lint y todas las pruebas.

## 10. Cómo extender la app

- **Nueva pantalla privada:** crea el componente en `features/<area>`, añade
  la ruta en `src/app/routes.tsx` con su `RequirePermission`, el enlace en el
  menú y, si conviene, sus pasos en `tourSteps.ts`.
- **Nuevo permiso:** agrégalo en una migración nueva (tabla `permissions` y
  `role_permissions`), en `PERMISSIONS` y `DEFAULT_ROLE_PERMISSIONS` y en las
  políticas RLS que lo usen; añade una prueba en `rls.test.ts`.
- **Nueva tabla:** migración nueva con RLS activada y políticas, trigger de
  auditoría si es contenido, método en el puerto y en los dos adaptadores.
- **Nuevo tipo de sección:** regístralo en `sections/registry.tsx` y en su
  editor; no hace falta tocar el resto.

Las migraciones ya aplicadas no se editan: cada cambio va en un archivo nuevo
con fecha posterior. Después de agregar una, corre `npm run db:setup-sql` (una
prueba comprueba que `supabase/setup.sql` esté al día).

## 11. Migraciones

| Archivo | Qué hace |
| --- | --- |
| `…1015000100_core_schema` | Perfiles, roles, permisos, `has_permission` y protección contra escalada |
| `…1015000200_content` | Ajustes, secciones, fotos, hitos, fechas y sorpresas |
| `…1015000300_messaging` | Cajita, chat, avisos y suscripciones push |
| `…1015000400_audit_realtime` | Auditoría por triggers y publicación de Realtime |
| `…1015000500_photo_fingerprint` | Huella SHA-256 de cada foto para saltar repetidas |
| `…1015000600_theme_palette` | Permiso de paleta para Camila (lo retira `personal_colors`) |
| `…1015000700_invitations` | Invitaciones por enlace o QR |
| `…1020000100_chat_replies_presence` | Respuestas citando, última conexión y vistos |
| `…1020000200_chat_media` | Fotos y stickers en el chat, bucket `chat-media` |
| `…1020000300_personal_colors` | Colores por persona y Rosa vino para quien no tiene cuenta |
| `…1020000400_device_push` | Avisos al celular, avisos de sorpresas y aviso de prueba |
| `…1021000100_todo_lists` | Listas compartidas con tareas, subtareas, materiales y fotos, bucket `list-media` y permiso `lists.use` |
| `…1021000200_profile_details` | Perfil editable: foto (bucket `avatars`), icono, frase y cumpleaños |
