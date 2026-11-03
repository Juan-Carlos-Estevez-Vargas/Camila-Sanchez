# Seguridad · mapa OWASP

Cómo cubre la app cada riesgo del **OWASP Top 10 (2021)** y del **OWASP API
Security Top 10 (2023)**, y qué controles de **ASVS 4** aplican. Cada fila dice
dónde vive el control y qué prueba lo vigila, para que no se pierda en un
cambio futuro.

## Lista de verificación

Repaso punto por punto (noviembre de 2026). ✅ ya estaba cubierto ·
🔧 se reforzó en la revisión (migración `20261103000600_security_review.sql`
y scripts de CI) · ✋ se activa a mano fuera del código.

| Punto | Estado | Cómo se cubre | Prueba |
| --- | --- | --- | --- |
| **Ocultar API keys** | ✅ 🔧 | El navegador sólo tiene la anon key, que es pública por diseño (la protege el RLS). La `service_role` vive sólo en las Edge Functions. Nuevo: el build se detiene si una variable `VITE_*` trae la `service_role` u otra clave secreta, y CI revisa que `dist/` no lleve ninguna. | `scripts/check-secrets.test.ts`, CI |
| **Eliminar secretos de git** | ✅ 🔧 | Se revisaron los 130 commits del historial: no hay claves (sólo la contraseña `demo1234` del modo demo, que vive en el navegador y no es de nadie). `.env*` está en `.gitignore`. Nuevo: CI busca secretos en los archivos y en **todo el historial** en cada push. | `scripts/check-secrets.mjs --history` |
| **Row level security** | ✅ | Todas las tablas tienen RLS (también la nueva `edge_rate_limits`, sin ninguna política) y los cuatro buckets son privados con políticas por carpeta. | `supabase/tests/rls.test.ts` |
| **Encriptar datos sensibles** | ✅ 🔧 | Supabase cifra el disco (AES-256) y todo viaja por TLS. Los tokens de invitación se guardan como SHA-256, el secreto de send-push en Vault, y ahora las IPs del límite de velocidad como HMAC (nunca en claro). Al cerrar sesión se borra la caché local. El chat **no** va cifrado de punta a punta: rompería la búsqueda y los avisos con vista previa. | `invitations.test.ts`, `rls.test.ts` |
| **Bloquear manipulación de campos** | ✅ 🔧 | Triggers que no dejan cambiar rol ni estado sin permiso, el texto de un aviso o una notita, ni la lista o la autoría de una tarea; la autoría la pone la base. Nuevo: `guard_immutable_columns` impide reescribir `created_by`/`created_at` de fotos y sorpresas, y mover una reacción a otro mensaje. | `rls.test.ts` |
| **Proteger sesión / cookies** | ✅ | La app no usa cookies (nada que robar por CSRF). El token vive en `sessionStorage` o, con «Mantener la sesión», en `localStorage`; la CSP impide que un script ajeno lo lea o lo mande a otro sitio. Tokens de 1 h con rotación del de refresco, PKCE, cerrar sesión en todos los dispositivos. Si algún día se usan cookies: `HttpOnly; Secure; SameSite=Lax`. | `sessionPersistence.test.ts`, `securityHeaders.test.ts` |
| **Hashear contraseñas** | ✅ ✋ | Supabase Auth las guarda con bcrypt; la app nunca las guarda ni las registra. Reglas de 10 a 72 caracteres sin las más comunes ni el propio nombre o correo. ✋ *Leaked password protection* (plan Pro). | `password.test.ts` |
| **Rate limiting** | ✅ 🔧 | `enforce_rate_limit` en chat, contactos, reacciones, notitas, invitaciones, listas, tareas y fotos de tareas. Nuevo: sorpresas (20/h) y Edge Functions con `hit_edge_rate_limit`: `admin-users` 60 acciones cada 10 min por persona. Supabase Auth limita los intentos por IP. | `rls.test.ts` |
| **Protección contra bots** | ✅ 🔧 | Registro cerrado (sólo invitación con token de 256 bits). `redeem-invite`, la única función sin sesión, frena a cada IP con 30 consultas o 5 intentos de crear cuenta cada 10 minutos (responde 429). Nuevo: **CAPTCHA con Cloudflare Turnstile** en entrar, enlace mágico, recuperar contraseña y crear cuenta por invitación (Supabase Auth y `redeem-invite` comprueban la ficha). Se enciende con `VITE_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` ([pasos](DESPLIEGUE.md#captcha-contra-bots-opcional)); la CSP sólo se abre a Cloudflare cuando está encendido. | `tokenQueue.test.ts`, `captchaCsp.test.ts`, `rls.test.ts` |
| **Parametrizar queries** | ✅ | Todo pasa por supabase-js / PostgREST con parámetros. El único SQL dinámico (`reorder_items`, `enforce_rate_limit`, triggers de auditoría) usa `format('%I')` con lista blanca, y las búsquedas escapan `%`, `_` y `\` del `LIKE`. Las funciones `security definer` fijan `search_path`. | `rls.test.ts` |
| **Validar inputs** | ✅ | `CHECK` de largo y formato en cada columna de texto, rutas y colores; las Edge Functions validan y recortan cada campo; el navegador valida colores, fuentes y URLs antes de usarlas. | `validation.test.ts`, `rls.test.ts` |
| **Sanitizar contenido** | ✅ | React escapa todo el texto y no hay `dangerouslySetInnerHTML`; los enlaces de los avisos y las redirecciones sólo van a rutas internas; CSP sin scripts en línea. | `safeRedirect.test.ts`, `securityHeaders.test.ts` |
| **Restringir archivos** | ✅ | Buckets privados que sólo aceptan WebP, JPEG, PNG (y AVIF en el álbum), nunca SVG ni HTML; máximo 5 MB (2 MB los avatares); la ruta del archivo se valida con una expresión regular y cada quien sólo sube a su carpeta. | `rls.test.ts` |
| **Forzar HTTPS** | ✅ | Netlify redirige HTTP → HTTPS; HSTS de un año con subdominios y `upgrade-insecure-requests`. Las URLs de avatar y de push deben ser `https://`. | `securityHeaders.test.ts` |
| **Escanear dependencias** | ✅ 🔧 | `npm audit` en cada CI y Dependabot. Nuevo: lo que llega al navegador ni con fallas moderadas (`--omit=dev --audit-level=moderate`), y `audit-edge-deps.mjs` revisa los paquetes `npm:` de las Edge Functions (que `npm audit` no veía) y exige versiones exactas. Se forzó `minimatch` ≥ 11.0.1 (falla moderada en la cadena de ESLint). | `scripts/audit-edge-deps.test.ts`, CI |

Para revisarlo en local: `npm run security`.

## OWASP Top 10

| Riesgo | Cómo se cubre | Dónde | Prueba |
| --- | --- | --- | --- |
| **A01 · Control de acceso roto** | RLS en todas las tablas y buckets; permisos resueltos en SQL (`has_permission`); triggers que impiden escalar rol, editar notitas o avisos ajenos, mover tareas de lista o fingir autoría (`stamp_created_by`). Las funciones internas no se pueden llamar sin sesión. Redirecciones (`?next=`, enlaces de avisos, service worker) sólo a rutas internas. | `supabase/migrations/*`, `src/core/safeRedirect.ts`, `public/sw.js` | `supabase/tests/rls.test.ts` |
| **A02 · Fallas criptográficas** | Sólo HTTPS (HSTS + `upgrade-insecure-requests`). Tokens de invitación de 256 bits guardados como SHA-256. Secretos en Supabase Vault y secretos de funciones, nunca en el repo. Comparación del secreto del webhook en tiempo constante. | `public/_headers`, `invitations`, `send-push` | `securityHeaders.test.ts`, `invitations.test.ts` |
| **A03 · Inyección** | Consultas parametrizadas (supabase-js / PostgREST); el único SQL dinámico (`reorder_items`, `enforce_rate_limit`) usa `format('%I')` con lista blanca. React escapa todo el texto; colores, fuentes y URLs se validan antes de llegar a CSS o a `src`. CSP sin `unsafe-inline` ni `unsafe-eval` para scripts. | `src/core/validation.ts`, migraciones | `validation.test.ts`, `rls.test.ts` |
| **A04 · Diseño inseguro** | Registro cerrado (sólo invitación), un solo uso y caducidad en invitaciones y enlaces de recuperación, siempre queda un super admin, límites de velocidad en la base. | migraciones, `redeem-invite` | `rls.test.ts` |
| **A05 · Configuración insegura** | CSP estricta (imágenes sólo del sitio o de Supabase), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP y CORP, `X-Permitted-Cross-Domain-Policies`. CORS de las funciones limitado al dominio del sitio. Zonas privadas con `noindex`. Errores sin trazas internas. | `public/_headers`, `vercel.json`, `_shared/cors.ts` | `securityHeaders.test.ts` |
| **A06 · Componentes vulnerables** | `npm audit --audit-level=high` en cada CI (moderado para las dependencias de producción), Dependabot semanal (npm) y mensual (acciones), versiones exactas y auditadas en las Edge Functions (`audit-edge-deps.mjs`). | `.github/workflows/ci.yml`, `.github/dependabot.yml` | CI |
| **A07 · Fallas de autenticación** | Contraseñas de 10 a 72 caracteres, sin las más usadas ni el propio nombre o correo (mismas reglas en el navegador y en las funciones). Tokens de 1 h con rotación de refresco, límite de intentos por IP, sin cuentas anónimas, cambio de correo confirmado en ambos correos, cerrar sesión en todos lados. | `supabase/functions/_shared/password.ts`, `deploy.yml`, `config.toml` | `password.test.ts` |
| **A08 · Integridad de software y datos** | Acciones de GitHub fijadas por SHA; `npm ci` con lockfile; los avisos push sólo los dispara la base con un secreto. | workflows | CI |
| **A09 · Registro y monitoreo** | `audit_log` inmutable desde el navegador (cambios de contenido, roles, invitaciones) y, desde ahora, **quién** creó, desactivó, borró o pidió un enlace de recuperación para una cuenta (`accounts`). Visible en *Administración → Auditoría*. | `audit_row()`, `admin-users` | `rls.test.ts` |
| **A10 · SSRF** | La función `send-push` sólo contacta servicios de push reales (Google, Mozilla, Apple, Microsoft); la base rechaza cualquier otra dirección. | `push_subscriptions_endpoint_service`, `send-push` | `rls.test.ts` |

## OWASP API Security Top 10

| Riesgo | Control |
| --- | --- |
| API1 · Autorización a nivel de objeto | RLS por fila: notitas, avisos, listas y fotos sólo de sus dueños o miembros. Cada chat (mensajes, fotos, reacciones, vistos y «escribiendo…») sólo lo ven quienes están en él; sólo se escribe a un contacto aceptado y no bloqueado; la conexión de alguien sólo la ve quien comparte un chat con esa persona. |
| API2 · Autenticación | Supabase Auth con PKCE; las funciones con service role verifican el token y el permiso antes de actuar. |
| API3 · Autorización por propiedad | Triggers que sólo dejan cambiar las columnas permitidas (avisos sólo `read_at`, perfil sólo su dueño, etc.). |
| API4 · Consumo sin límite | Límites de velocidad en las Edge Functions (`redeem-invite` por IP, `admin-users` por persona) y en la base: sorpresas 20/h, chat 30/min, solicitudes de contacto 20/h, reacciones 60/min, notitas 20 cada 10 min, invitaciones 20/h, listas 30/h, tareas 200 y fotos de tareas 60 cada 10 min. Tamaño máximo de archivos por bucket y de cada texto. |
| API5 · Autorización por función | `reorder_items`, `create_todo_list`, `chat_presence`, `chat_request_contact`, `chat_respond_contact`, `chat_edit_message`, `chat_delete_message`… comprueban permisos y la sesión; las funciones internas no tienen `execute` para `anon`. |
| API6 · Flujos de negocio sensibles | Invitaciones de un solo uso; aviso de prueba una vez por minuto. |
| API7 · SSRF | Ver A10. |
| API8 · Configuración | Ver A05. |
| API9 · Inventario | Las Edge Functions y su configuración están en `supabase/` y se publican sólo desde `Deploy`. |
| API10 · Consumo inseguro de APIs | Las respuestas de los servicios de push sólo se usan para borrar suscripciones vencidas. |

## Lo que se activa a mano (fuera del código)

- **Supabase → Authentication → Policies → Leaked password protection**
  (planes Pro): rechaza contraseñas que aparecen en filtraciones públicas.
- **GitHub → Settings → Code security**: activar *Secret scanning*, *Push
  protection* y *Dependabot alerts* (complementan el buscador de secretos de
  CI: bloquean el push antes de que el secreto llegue a GitHub).
- **CAPTCHA** contra bots: crear las claves de Cloudflare Turnstile y
  ponerlas en Netlify y GitHub, en ese orden
  ([pasos](DESPLIEGUE.md#captcha-contra-bots-opcional)). El código ya está.
- Si algún día hace falta, **MFA** para el super administrador
  (Supabase → Authentication → Multi-factor).
