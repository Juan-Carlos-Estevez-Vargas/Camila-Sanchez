# Despliegue y operación

Cómo poner la app en producción con Supabase, GitHub Actions y Netlify, y cómo
funcionan las versiones, la recuperación de contraseña y los avisos al celular.
Para probarla en local sin cuentas basta el [modo demo](../README.md#inicio-rápido).

## Pasos

Ningún secreto va en el repositorio: las claves sólo se pegan en los paneles
de Supabase, GitHub y Netlify. No hace falta instalar nada en tu computador.
Después de esto, **cada merge a `main` o `master` se despliega solo**:
Netlify vuelve a publicar la web y el flujo
[`Deploy`](../.github/workflows/deploy.yml) aplica las migraciones nuevas, ajusta
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

## Versiones y releases

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

## Recuperar contraseña

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

## Avisos en la pantalla de notificaciones del celular

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

## Sin GitHub Actions

Si prefieres no usar el flujo `Deploy`, pega `supabase/setup.sql` (todas las
migraciones y el contenido inicial en un solo archivo) en el *SQL Editor* en
lugar del paso 2, y configura a mano *Authentication → URL Configuration* y
*Sign In / Providers → Allow new users to sign up* (apagado). No mezcles las
dos formas en el mismo proyecto: el flujo no sabría que las migraciones ya
están aplicadas. Sin el flujo, los avisos al celular no quedan configurados:
habría que publicar `send-push` con sus secretos y crear en Vault
`push_function_url` y `push_webhook_secret` a mano. Si cambias una migración, regenera el archivo con
`npm run db:setup-sql`.

## Sobre la privacidad del repositorio

Este repositorio es **público** y contiene fotos personales en
`public/assets/img`. Las fotos nuevas ya se guardan en el bucket privado de
Supabase, no en git. Te recomiendo hacer el repositorio privado (Settings →
General → Danger Zone) y, si quieres, mover también las fotos antiguas al
panel; la decisión es tuya.
