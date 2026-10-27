# Seguridad · mapa OWASP

Cómo cubre la app cada riesgo del **OWASP Top 10 (2021)** y del **OWASP API
Security Top 10 (2023)**, y qué controles de **ASVS 4** aplican. Cada fila dice
dónde vive el control y qué prueba lo vigila, para que no se pierda en un
cambio futuro.

## OWASP Top 10

| Riesgo | Cómo se cubre | Dónde | Prueba |
| --- | --- | --- | --- |
| **A01 · Control de acceso roto** | RLS en todas las tablas y buckets; permisos resueltos en SQL (`has_permission`); triggers que impiden escalar rol, editar notitas o avisos ajenos, mover tareas de lista o fingir autoría (`stamp_created_by`). Las funciones internas no se pueden llamar sin sesión. Redirecciones (`?next=`, enlaces de avisos, service worker) sólo a rutas internas. | `supabase/migrations/*`, `src/core/safeRedirect.ts`, `public/sw.js` | `supabase/tests/rls.test.ts` |
| **A02 · Fallas criptográficas** | Sólo HTTPS (HSTS + `upgrade-insecure-requests`). Tokens de invitación de 256 bits guardados como SHA-256. Secretos en Supabase Vault y secretos de funciones, nunca en el repo. Comparación del secreto del webhook en tiempo constante. | `public/_headers`, `invitations`, `send-push` | `securityHeaders.test.ts`, `invitations.test.ts` |
| **A03 · Inyección** | Consultas parametrizadas (supabase-js / PostgREST); el único SQL dinámico (`reorder_items`, `enforce_rate_limit`) usa `format('%I')` con lista blanca. React escapa todo el texto; colores, fuentes y URLs se validan antes de llegar a CSS o a `src`. CSP sin `unsafe-inline` ni `unsafe-eval` para scripts. | `src/core/validation.ts`, migraciones | `validation.test.ts`, `rls.test.ts` |
| **A04 · Diseño inseguro** | Registro cerrado (sólo invitación), un solo uso y caducidad en invitaciones y enlaces de recuperación, siempre queda un super admin, límites de velocidad en la base. | migraciones, `redeem-invite` | `rls.test.ts` |
| **A05 · Configuración insegura** | CSP estricta (imágenes sólo del sitio o de Supabase), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP y CORP, `X-Permitted-Cross-Domain-Policies`. CORS de las funciones limitado al dominio del sitio. Zonas privadas con `noindex`. Errores sin trazas internas. | `public/_headers`, `vercel.json`, `_shared/cors.ts` | `securityHeaders.test.ts` |
| **A06 · Componentes vulnerables** | `npm audit --audit-level=high` en cada CI, Dependabot semanal (npm) y mensual (acciones), versiones exactas en las Edge Functions. | `.github/workflows/ci.yml`, `.github/dependabot.yml` | CI |
| **A07 · Fallas de autenticación** | Contraseñas de 10 a 72 caracteres, sin las más usadas ni el propio nombre o correo (mismas reglas en el navegador y en las funciones). Tokens de 1 h con rotación de refresco, límite de intentos por IP, sin cuentas anónimas, cambio de correo confirmado en ambos correos, cerrar sesión en todos lados. | `supabase/functions/_shared/password.ts`, `deploy.yml`, `config.toml` | `password.test.ts` |
| **A08 · Integridad de software y datos** | Acciones de GitHub fijadas por SHA; `npm ci` con lockfile; los avisos push sólo los dispara la base con un secreto. | workflows | CI |
| **A09 · Registro y monitoreo** | `audit_log` inmutable desde el navegador (cambios de contenido, roles, invitaciones) y, desde ahora, **quién** creó, desactivó, borró o pidió un enlace de recuperación para una cuenta (`accounts`). Visible en *Administración → Auditoría*. | `audit_row()`, `admin-users` | `rls.test.ts` |
| **A10 · SSRF** | La función `send-push` sólo contacta servicios de push reales (Google, Mozilla, Apple, Microsoft); la base rechaza cualquier otra dirección. | `push_subscriptions_endpoint_service`, `send-push` | `rls.test.ts` |

## OWASP API Security Top 10

| Riesgo | Control |
| --- | --- |
| API1 · Autorización a nivel de objeto | RLS por fila: notitas, avisos, listas y fotos sólo de sus dueños o miembros. |
| API2 · Autenticación | Supabase Auth con PKCE; las funciones con service role verifican el token y el permiso antes de actuar. |
| API3 · Autorización por propiedad | Triggers que sólo dejan cambiar las columnas permitidas (avisos sólo `read_at`, perfil sólo su dueño, etc.). |
| API4 · Consumo sin límite | Límites de velocidad en la base: chat 30/min, notitas 20 cada 10 min, invitaciones 20/h, listas 30/h, tareas 200 y fotos de tareas 60 cada 10 min. Tamaño máximo de archivos por bucket y de cada texto. |
| API5 · Autorización por función | `reorder_items`, `create_todo_list`, `chat_presence`… comprueban permisos; las funciones internas no tienen `execute` para `anon`. |
| API6 · Flujos de negocio sensibles | Invitaciones de un solo uso; aviso de prueba una vez por minuto. |
| API7 · SSRF | Ver A10. |
| API8 · Configuración | Ver A05. |
| API9 · Inventario | Las Edge Functions y su configuración están en `supabase/` y se publican sólo desde `Deploy`. |
| API10 · Consumo inseguro de APIs | Las respuestas de los servicios de push sólo se usan para borrar suscripciones vencidas. |

## Lo que se activa a mano (fuera del código)

- **Supabase → Authentication → Policies → Leaked password protection**
  (planes Pro): rechaza contraseñas que aparecen en filtraciones públicas.
- **GitHub → Settings → Code security**: activar *Secret scanning*, *Push
  protection* y *Dependabot alerts*.
- Si algún día hace falta, **MFA** para el super administrador
  (Supabase → Authentication → Multi-factor).
