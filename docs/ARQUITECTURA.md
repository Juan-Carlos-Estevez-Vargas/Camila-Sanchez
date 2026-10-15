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
| Archivos | Supabase Storage, bucket privado `photos` | Fotos servidas con URLs firmadas |
| Tiempo real | Supabase Realtime | Chat, notificaciones y contenido que se actualiza solo |
| Funciones | Edge Functions en Deno | Gestión de cuentas, invitaciones y Web Push |
| Publicación | Netlify (web) y GitHub Actions (backend y releases) | Despliegue continuo en cada merge |

## 2. Estructura del repositorio

```
src/
  app/        armazón: rutas, cabecera, pie de página, manejo de errores
  core/       configuración, validación, errores, EventBus, SEO, autor
  domain/     reglas puras: tipos, permisos, fechas, invitaciones, recuperación, paletas
  data/       puertos (ports.ts) y adaptadores: supabase/ y demo/
  services/   cola de tareas, pipeline de imágenes (Web Workers), notificaciones, <head>
  state/      contextos de React: backend, auth, contenido, tema, notificaciones, toasts
  ui/         componentes reutilizables: modal, campos, feedback, cargador romántico
  features/   funcionalidades: site, auth, admin (panel), super, messages, chat, tour
  styles/     sistema de diseño SCSS: abstracts, base, components, layout
supabase/
  migrations/ esquema, RLS, triggers, bucket y publicación realtime (en orden)
  functions/  admin-users, redeem-invite, send-push (+ _shared/cors.ts)
  templates/  correo de recuperación de contraseña
  tests/      pruebas de RLS sobre PGlite (Postgres en WebAssembly)
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
`ThemedShell` dibuja la cabecera, las rutas y el pie.

- Rutas públicas: `/`, `/entrar`, `/invitacion`, `/recuperar`.
- Rutas privadas (`src/app/routes.tsx`): `/mensajes`, `/chat`, `/cuenta`,
  `/panel/*` y `/super/*`. Cada una se envuelve en `RequirePermission`, que
  manda a `/entrar?next=…` si no hay sesión y muestra un aviso si falta el
  permiso.
- Todas las áreas privadas se cargan con `lazy()`: quien sólo visita la página
  nunca descarga el código de los paneles.

### Estado

| Contexto | Qué guarda |
| --- | --- |
| `BackendContext` | La instancia del adaptador elegido |
| `AuthContext` | Usuario, perfil, `AccessPolicy` y acciones de sesión |
| `SiteContentStore` | Ajustes, secciones, fotos, hitos, fechas y sorpresas, más las URLs firmadas |
| `NotificationsContext` | Avisos, contador sin leer por tipo y notificaciones del sistema |
| `ThemeController` | Aplica el tema como custom properties en `:root` |
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

## 5. Backend (Supabase)

### Modelo de datos

Las tablas viven en `public` y se crean con las migraciones de
`supabase/migrations` (el diagrama entidad-relación está en
[DIAGRAMAS.md](DIAGRAMAS.md#modelo-de-datos)):

- **Acceso:** `profiles`, `permissions`, `role_permissions`, `invitations`.
- **Contenido:** `site_settings` (fila única), `sections`, `photos`,
  `milestones`, `important_dates`, `interruptions`, `interruption_views`.
- **Mensajería:** `notes`, `chat_messages`, `chat_reads`, `notifications`,
  `push_subscriptions`.
- **Trazabilidad:** `audit_log`.

### Roles y permisos (RBAC)

- Tres roles: `super_admin` (Juan), `editor` (Camila) y `viewer` (invitado).
- Los permisos (`site.view`, `photos.manage`, `chat.use`, …) están en la tabla
  `permissions` y se asignan por rol en `role_permissions`.
- `has_permission(p)` resuelve en SQL si la persona actual tiene un permiso;
  todas las políticas RLS la usan. El super administrador los tiene todos.
- Triggers (`guard_profile_changes`, `guard_site_settings`,
  `guard_section_changes`) impiden escalar privilegios, cambiar el propio rol o
  dejar el sitio sin super administrador.

### Triggers y automatismos

- `handle_new_user`: crea el perfil de cada usuario nuevo de Auth.
- `notify_new_note` y `notify_new_chat_message`: escriben en `notifications`
  cuando llega una notita o un mensaje. Sólo los triggers escriben ahí.
- `audit_row`: registra en `audit_log` cada INSERT, UPDATE o DELETE de las
  tablas auditadas. Los mensajes privados no se registran.
- Publicación `supabase_realtime`: avisa al navegador de los cambios.

### Edge Functions

| Función | Quién la llama | Qué hace |
| --- | --- | --- |
| `admin-users` | Super administrador con sesión | Crear, desactivar o borrar cuentas y generar enlaces de recuperación |
| `redeem-invite` | Cualquiera con un enlace de invitación | Comprobar y canjear la invitación de forma atómica |
| `send-push` | Database Webhook al insertar en `notifications` | Enviar Web Push a los dispositivos suscritos |

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
| Fotos expuestas | Bucket privado, sólo imágenes de hasta 5 MB, URLs firmadas, metadatos borrados al subir |
| Clickjacking y fugas de referer | `X-Frame-Options`, `frame-ancestors 'none'`, `Referrer-Policy` |
| Enumeración de cuentas | La recuperación responde igual exista o no el correo |

Las cabeceras están en `public/_headers` (Netlify) y `vercel.json`; una prueba
(`securityHeaders.test.ts`) comprueba que coincidan.

## 7. Tiempo real y notificaciones

1. Una notita o un mensaje se inserta con RLS.
2. Un trigger crea la fila en `notifications` para la otra persona.
3. Realtime la entrega al navegador abierto: se actualizan la campanita y los
   contadores y aparece un toast. Si la pestaña está en segundo plano, se
   muestra una notificación del sistema.
4. Si se configuró Web Push, un Database Webhook llama a `send-push`, que avisa
   al celular aunque la app esté cerrada. El service worker (`public/sw.js`)
   muestra el aviso y abre el enlace al tocarlo.

## 8. Integración y despliegue continuos

- **CI** (`.github/workflows/ci.yml`): en cada push y pull request ejecuta
  typecheck, lint, pruebas (unitarias y de RLS sobre PGlite) y build.
- **Deploy** (`.github/workflows/deploy.yml`): en cada merge a `master`
  - vuelve a correr las pruebas,
  - aplica las migraciones nuevas en Supabase,
  - configura Auth (URLs, registro cerrado, plantilla y SMTP opcional),
  - publica las Edge Functions,
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
| Unitarias de dominio | `src/domain/*.test.ts` | Fechas, invitaciones, recuperación, paletas |
| Unitarias de núcleo | `src/core/*.test.ts` | Validación, redirecciones seguras, SEO, cabeceras |
| Servicios | `src/services/**/*.test.ts` | Cola de tareas, EXIF, tamaños, carga masiva |
| Tutorial | `src/features/tour/*.test.ts` | Pasos por rol y posición de la tarjeta |
| Base de datos | `supabase/tests/rls.test.ts` | Políticas RLS y triggers sobre PGlite |
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
con fecha posterior.
