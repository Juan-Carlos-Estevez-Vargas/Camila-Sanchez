# Legal y privacidad

> **Importante:** los textos legales de la app son **plantillas** escritas para
> una app privada, gratuita y sin publicidad que se usa en Colombia. No son
> asesoría legal. Si la app cambia de propósito (se abre al público, cobra,
> muestra publicidad, la usan menores de edad o gente de otros países), que
> los revise una persona abogada.

Este documento explica qué se revisó, qué se agregó a la app y qué queda en
manos de quien la administra. Los diagramas están en
[DIAGRAMAS.md](DIAGRAMAS.md#legal-y-privacidad).

## Contenido

- [Lista de verificación](#lista-de-verificación)
- [Páginas legales](#páginas-legales)
- [Consentimiento](#consentimiento)
- [Aviso de cookies](#aviso-de-cookies)
- [Inventario de datos personales](#inventario-de-datos-personales)
- [Auditoría de SDKs y servicios de terceros](#auditoría-de-sdks-y-servicios-de-terceros)
- [Patrones oscuros](#patrones-oscuros)
- [Cobros](#cobros)
- [Donaciones](#donaciones)
- [Texto alternativo](#texto-alternativo)
- [Licencias de imágenes, fuentes y código](#licencias-de-imágenes-fuentes-y-código)
- [Qué tiene que hacer el administrador](#qué-tiene-que-hacer-el-administrador)
- [Cómo cambiar los textos](#cómo-cambiar-los-textos)

## Lista de verificación

| Punto | Estado | Dónde |
| --- | --- | --- |
| Política de privacidad | ✅ Política de tratamiento de datos según la Ley 1581 de 2012 y el Decreto 1074 de 2015 (responsable, datos, finalidades, encargados, transferencia internacional, derechos, plazos, menores) | `/legal/privacidad` |
| Términos y condiciones | ✅ Quién puede usarla, contenido permitido, propiedad de lo que se sube, licencia del código, disponibilidad, cierre de cuenta y ley aplicable | `/legal/terminos` |
| Política de reembolsos | ✅ La app es gratis: no hay nada que reembolsar ni derecho de retracto (Ley 1480 de 2011). Dice qué pasaría si algún día cobrara | `/legal/reembolsos` |
| Política de cookies | ✅ No hay cookies de seguimiento; lista lo que guarda el navegador y lo único opcional (Google Fonts) | `/legal/cookies` |
| Banner de consentimiento de cookies | ✅ Aviso no bloqueante, dos botones iguales, nada externo antes de elegir, se reabre desde el pie | `CookieBanner.tsx` |
| Consentimiento en formularios | ✅ Casilla desmarcada y obligatoria al crear la cuenta; diálogo para cuentas existentes; registro en `legal_consents` | `InvitePage.tsx`, `ConsentGate.tsx` |
| Recolección de datos personales | ✅ Inventario completo (abajo) y tarjeta «Privacidad y tus datos» en Mi cuenta | `PrivacyCard.tsx` |
| Auditoría de SDKs de terceros | ✅ Sin analítica, publicidad ni rastreadores. Google Fonts pasa a ser opcional | [abajo](#auditoría-de-sdks-y-servicios-de-terceros) |
| Patrones oscuros | ✅ Revisados; no se encontró ninguno. El aviso de cookies se diseñó sin ellos | [abajo](#patrones-oscuros) |
| Cobros ocultos | ✅ No hay pagos ni datos de pago; `Permissions-Policy: payment=()` | [abajo](#cobros) |
| Texto alternativo | ✅ Corregidas 3 imágenes; una prueba exige `alt` en toda `<img>` | `src/core/altText.test.ts` |
| Licencias de imágenes | ✅ Todo es propio o con licencia libre; una prueba revisa las licencias de las dependencias | `/legal/licencias`, `scripts/licenses.test.ts` |

## Páginas legales

Son públicas (se leen sin cuenta y aunque la página sea privada), indexables
si `VITE_SEO_INDEX` lo permite y están enlazadas en el pie de página:

| Ruta | Documento |
| --- | --- |
| `/legal` | Índice |
| `/legal/privacidad` | Política de privacidad y tratamiento de datos |
| `/legal/terminos` | Términos y condiciones |
| `/legal/cookies` | Política de cookies y almacenamiento |
| `/legal/reembolsos` | Cobros y reembolsos |
| `/legal/licencias` | Licencias y créditos |

El código está en `src/features/legal/` y los datos comunes (versión,
responsable, lista de documentos) en `src/domain/legal.ts`.

## Consentimiento

La Ley 1581 pide una autorización **previa, expresa e informada** y poder
demostrarla. Por eso:

- **Al crear la cuenta** (`/invitacion`) hay una casilla, desmarcada y
  obligatoria, con enlaces a los términos y la política (se abren en otra
  pestaña para no perder el formulario).
- **Quien ya tenía cuenta**, o todos cuando sube `LEGAL_VERSION`, ve una vez
  un diálogo al entrar: casilla + «Aceptar y seguir», o «Ahora no, cerrar
  sesión». En `/legal/*` el diálogo no aparece, para poder leer antes.
- Cada aceptación queda en la tabla `legal_consents` (migración
  `20261103000700_legal_consents.sql`): `user_id` y `accepted_at` los pone la
  base, no se pueden editar ni borrar y sólo quien gestiona usuarios ve las de
  los demás. Se borran con la cuenta.
- En **Mi cuenta → Privacidad y tus datos** cada persona ve qué versión
  aceptó y cuándo.

Los demás formularios (chat, notitas, fotos, listas, perfil) sólo guardan lo
que la persona escribe para usarlo dentro de la app, que es la finalidad ya
aceptada: no necesitan otra casilla.

## Aviso de cookies

La app **no usa cookies**. Usa `localStorage`, `sessionStorage` e IndexedDB
para cosas necesarias (sesión, caché del contenido, preferencias), que no
requieren consentimiento.

Lo único que antes se cargaba sin preguntar era **Google Fonts** (Fraunces e
Inter, desde `index.html`): cada visita mandaba la IP a Google. Ahora:

- `index.html` ya no tiene los `<link>` a Google.
- `ThemeController` sólo carga las fuentes si la elección guardada en
  `consent:cookies` tiene `externalFonts: true`.
- Sin elección o con «Sólo lo necesario» se usan las fuentes de respaldo del
  CSS (Georgia y la del sistema). La app se ve un poco distinta, pero todo
  funciona igual.

## Inventario de datos personales

| Dato | Tabla / lugar | Para qué | Quién lo ve |
| --- | --- | --- | --- |
| Correo y contraseña (hash bcrypt) | `auth.users` (Supabase Auth) | Entrar y recuperar la contraseña | Nadie lee la contraseña; el correo, quien gestiona usuarios |
| Nombre, rol, activo | `profiles` | Mostrar quién es quién y permisos | Personas de la app |
| Foto, icono, frase, cumpleaños, colores | `profiles`, bucket `avatars` | Perfil | Personas de la app |
| Fotos y descripciones | `photos`, bucket `photos` | Álbum | Según `site.view` / página pública |
| Notitas, mensajes, fotos y stickers, reacciones | `notes`, `chat_*`, bucket `chat-media` | Mensajería | Remitente y destinatarios |
| Listas, tareas, materiales, fotos | `todo_*`, bucket `list-media` | Listas compartidas | Miembros de la lista |
| Sorpresas, fechas, hitos | `interruptions`, `important_dates`, `milestones` | Contenido de la página | Según permisos y destinataria |
| Última conexión, vistos | `chat_reads`, `chat_participants` | «En línea» y ✓✓ | Contactos |
| Suscripciones push | `push_subscriptions` (endpoint, claves, navegador) | Avisos en el celular | Sólo la función `send-push` |
| Registro de cambios | `audit_log` | Revisar errores y abusos | Quien tiene `audit.view` |
| Aceptación de términos | `legal_consents` | Prueba de la autorización | La persona y quien gestiona usuarios |
| IP (con HMAC si aplica) | Registros de Supabase y Netlify; límites de velocidad | Seguridad | Proveedores |

No se piden datos sensibles. Las fotos pierden los metadatos EXIF (GPS
incluido) al optimizarse en el navegador.

## Auditoría de SDKs y servicios de terceros

Dependencias que llegan al navegador (`npm ls --omit=dev`): React, React
Router, Supabase JS, idb-keyval y qrcode, más sus dependencias. **Ninguna**
hace analítica, publicidad, huella digital ni envía datos a terceros por su
cuenta.

| Servicio | Cuándo se contacta | Datos | Decisión |
| --- | --- | --- | --- |
| Supabase | Al usar la app | Todos los de la tabla anterior | Necesario (encargado). Mencionado en la política |
| Netlify | Al abrir la página | IP, navegador | Necesario (hosting) |
| Google Fonts | **Antes:** siempre. **Ahora:** sólo con permiso | IP, navegador | Pasa a opcional con el aviso de cookies |
| Cloudflare Turnstile | Sólo si se activa el CAPTCHA | IP, señales del navegador | Necesario para seguridad; mencionado en privacidad y cookies |
| Servicio push del navegador (FCM, APNs, Mozilla) | Sólo si se activan los avisos | Aviso cifrado | Lo pide la persona con un botón; nunca se pide permiso solo |
| Servidor de la música | Sólo al pulsar ♪ | IP | La persona lo activa |
| GitHub, LinkedIn, Instagram | Sólo al pulsar sus enlaces | — | Enlaces normales, sin scripts ni widgets |
| Plataforma de donación (`VITE_DONATION_URL`) | Sólo al pulsar «Invítame un café» | Lo que la persona le dé a esa plataforma | Enlace normal: sin SDK, sin botón embebido, sin cambiar la CSP |

La CSP de producción (`public/_headers`, `vercel.json`) ya impide cargar
scripts de otros orígenes, así que ningún SDK puede colarse sin cambiarla.

## Patrones oscuros

Se revisaron los flujos donde suelen aparecer:

| Patrón | Resultado |
| --- | --- |
| Casillas premarcadas | La de consentimiento viene desmarcada. «Mantener la sesión iniciada» viene encendida, pero es una comodidad con explicación visible y no comparte datos |
| Aviso de cookies con «Aceptar» destacado y «Rechazar» escondido | Los dos botones tienen el mismo estilo y tamaño; no hay muro que bloquee la página |
| Pedir permisos de notificación al entrar | Sólo se piden al pulsar «Activar avisos» |
| Vergüenza al rechazar (*confirmshaming*) | Ningún texto culpa a la persona por decir que no |
| Darse de baja difícil | Borrar la cuenta se pide por un canal directo, sin preguntas ni costo, con plazo legal; Juan la borra en **Super → Usuarios** |
| Urgencia o escasez falsa, costos escondidos, suscripciones | No existen |
| Música o sonidos automáticos | La música nunca suena sola |

## Cobros

La app no tiene pasarela de pago, no pide tarjetas y no muestra anuncios.
Lo único relacionado con dinero es el botón opcional **«Invítame un café»** del
pie de página (`VITE_DONATION_URL`, ver [Donaciones](#donaciones)).
`Permissions-Policy: payment=()` desactiva la API de pagos del navegador en
todas las páginas. `/legal/reembolsos` lo deja por escrito y promete que, si
algún día cobrara, se avisaría antes y se pediría aceptarlo.

## Donaciones

Se evaluó poner publicidad y se descartó: con el tráfico de una app privada
de pareja los ingresos serían de centavos al mes, obligaría a cargar scripts
de rastreo (CSP, aviso de cookies, política) y los anuncios «ocultos» o
disfrazados violan las políticas de AdSense y similares. En su lugar hay un
enlace de donación voluntaria:

- Es un `<a>` normal a la plataforma (Ko-fi, Buy Me a Coffee, GitHub
  Sponsors, PayPal…). No se carga ningún script ni widget, así que la CSP y
  el aviso de cookies no cambian.
- Sólo se aceptan URLs `https` sin credenciales (`src/core/donation.ts`, con
  pruebas). Si la variable está vacía o es inválida, el botón no aparece.
- Está etiquetado como voluntario, no desbloquea nada y no aparece en el
  chat ni en los recuerdos: sólo en el pie, con el mismo peso que las redes.
- `/legal/reembolsos` y la política de privacidad explican que el pago lo
  hace la plataforma con sus propias condiciones. No cambia lo que la app
  recoge, así que `LEGAL_VERSION` no sube (sólo la fecha de actualización).

## Texto alternativo

Todas las `<img>` tienen `alt`. Las decorativas o envueltas en un botón con
`aria-label` llevan `alt=""` a propósito. Se corrigieron:

- La foto de cada hito en la línea de tiempo (antes `alt=""`, ahora
  «Foto de «título del hito»»).
- Las fotos sin descripción en el panel (antes quedaban con `alt` vacío).
- La vista previa de una foto por enviar en el chat.

El campo «Mensaje de la foto» del panel ahora dice que también es su texto
alternativo. `src/core/altText.test.ts` falla si alguien agrega una `<img>`
sin `alt`.

## Licencias de imágenes, fuentes y código

| Recurso | Origen | Licencia |
| --- | --- | --- |
| Código de la app | Propio | MIT ([LICENSE](../LICENSE)) |
| Fotos de `public/assets/img` y las que se suben | De la pareja | Todos los derechos reservados (fuera de la MIT) |
| Icono del corazón, iconos PWA, stickers | SVG propios | MIT |
| Emojis | Fuente de emojis del sistema de cada dispositivo | No se distribuyen |
| Fraunces, Inter, Playfair Display, Cormorant Garamond, Dancing Script, Nunito, Lora, Source Sans 3 | Google Fonts | SIL Open Font License 1.1 |
| Dependencias de producción | npm | MIT, ISC, Apache 2.0 y 0BSD (las revisa `scripts/licenses.test.ts`) |
| Música de fondo | Enlace que configura el administrador | Responsabilidad de quien lo pone |

No hay fotos de bancos de imágenes.

## Qué tiene que hacer el administrador

1. **Correo de contacto:** `DATA_CONTROLLER.email` (`src/domain/legal.ts`)
   es el canal para ejercer los derechos sobre los datos; si cambia, cámbialo
   ahí y los textos se actualizan solos.
2. **Fotos de otras personas:** si la página se pone pública (Super →
   Ajustes), cualquiera verá las fotos. Asegúrate de que quienes salen en
   ellas estén de acuerdo.
3. **Responder a tiempo:** consultas en máximo 10 días hábiles, reclamos
   (corregir, borrar, retirar la autorización) en máximo 15.
4. **Registro Nacional de Bases de Datos (SIC):** sólo es obligatorio para
   empresas y entidades con activos de más de 100 000 UVT, no para una
   persona natural con una app privada. Si eso cambia, hay que registrarla.

## Cómo cambiar los textos

- Los textos están en `src/features/legal/documents/*.tsx`.
- Si cambias algo importante de los términos o la privacidad, sube
  `LEGAL_VERSION` y `LEGAL_UPDATED_ON` en `src/domain/legal.ts` (formato
  `AAAA-MM-DD`): todos verán otra vez el diálogo para aceptar.
- Si agregas un servicio externo, súmalo a la política de privacidad, a la de
  cookies (y al aviso si es opcional) y a la tabla de auditoría de arriba.
