# Diagramas

Diagramas de la app en [Mermaid](https://mermaid.js.org/). GitHub los dibuja
directamente al abrir este archivo. La explicación de cada pieza está en
[ARQUITECTURA.md](ARQUITECTURA.md).

- [Arquitectura general](#arquitectura-general)
- [Capas del frontend](#capas-del-frontend)
- [Navegación y permisos](#navegación-y-permisos)
- [Inicio de sesión](#inicio-de-sesión)
- [Invitación por enlace o QR](#invitación-por-enlace-o-qr)
- [Recuperación de contraseña](#recuperación-de-contraseña)
- [Subida de fotos](#subida-de-fotos)
- [Notitas, chat y notificaciones](#notitas-chat-y-notificaciones)
- [Chat: respuestas, conexión y vistos](#chat-respuestas-conexión-y-vistos)
- [Chat: fotos y stickers](#chat-fotos-y-stickers)
- [Tutorial guiado](#tutorial-guiado)
- [Integración y despliegue](#integración-y-despliegue)
- [Modelo de datos](#modelo-de-datos)
- [Roles y permisos](#roles-y-permisos)

## Arquitectura general

```mermaid
flowchart LR
  subgraph Navegador
    SPA["SPA React<br/>(Netlify, archivos estáticos)"]
    SW["Service worker<br/>sw.js"]
  end
  subgraph Supabase
    AUTH["Auth<br/>PKCE + rotación de tokens"]
    DB[("Postgres<br/>RLS + triggers")]
    ST[("Storage<br/>bucket privado photos")]
    RT["Realtime"]
    subgraph Edge["Edge Functions"]
      AU["admin-users"]
      RI["redeem-invite"]
      SP["send-push"]
    end
  end
  GH["GitHub Actions<br/>CI · Deploy · Release"]
  NL["Netlify"]

  SPA -- "sesión" --> AUTH
  SPA -- "consultas con JWT" --> DB
  SPA -- "URLs firmadas" --> ST
  RT -- "cambios" --> SPA
  SPA -- "acciones de admin" --> AU
  SPA -- "canje de invitación" --> RI
  DB -- "pg_net al crear aviso" --> SP
  SP -- "Web Push" --> SW
  AU & RI & SP -- "service_role" --> DB
  GH -- "migraciones y funciones" --> Supabase
  GH -. "merge a master" .-> NL
  NL -- "publica" --> SPA
```

## Capas del frontend

```mermaid
flowchart TB
  F["features/<br/>site · auth · admin · super · messages · chat · tour"]
  UI["ui/<br/>modal, campos, feedback, cargador"]
  S["state/<br/>contextos: auth, contenido, tema, avisos"]
  SV["services/<br/>cola, imágenes, notificaciones"]
  P["data/ports.ts<br/>interfaz Backend"]
  A1["data/supabase<br/>adaptador real"]
  A2["data/demo<br/>adaptador local"]
  D["domain/ + core/<br/>reglas puras, sin React ni Supabase"]

  F --> UI & S & SV & D
  S --> P
  SV --> P
  P -. "implementa" .- A1
  P -. "implementa" .- A2
  S & SV & A1 & A2 --> D
```

## Navegación y permisos

```mermaid
flowchart TD
  A["La persona abre una ruta"] --> B{"¿Es pública?<br/>/, /entrar, /invitacion, /recuperar"}
  B -- "sí" --> P["Se muestra"]
  B -- "no" --> C{"¿Hay sesión?"}
  C -- "no" --> L["/entrar?next=ruta"]
  L --> LG["Inicia sesión"] --> R["Vuelve a la ruta<br/>(sólo rutas internas)"]
  C -- "sí" --> D{"¿AccessPolicy lo permite?"}
  D -- "no" --> E["«Esta parte no está disponible para tu cuenta»"]
  D -- "sí" --> F["Carga diferida de la pantalla"]
  F --> G["Cada consulta pasa por RLS<br/>has_permission() en Postgres"]
  G -- "permitido" --> OK["Datos"]
  G -- "denegado" --> X["Error 403 / sin filas"]
```

## Inicio de sesión

```mermaid
sequenceDiagram
  actor U as Persona
  participant App as SPA
  participant Auth as Supabase Auth
  participant DB as Postgres

  U->>App: correo + contraseña (+ mantener sesión)
  App->>Auth: signInWithPassword
  Auth-->>App: access token 1 h + refresh token
  Note over App: localStorage si «mantener sesión»,<br/>sessionStorage si no
  App->>DB: my_permissions()
  DB-->>App: rol y permisos
  App-->>U: menú según AccessPolicy
  loop antes de vencer
    App->>Auth: refresh token
    Auth-->>App: tokens nuevos (el anterior deja de servir)
  end
```

## Invitación por enlace o QR

```mermaid
sequenceDiagram
  actor J as Juan
  participant App as SPA de Juan
  participant DB as Postgres
  actor I as Invitado
  participant App2 as SPA del invitado
  participant RI as redeem-invite
  participant Auth as Supabase Auth

  J->>App: Crear enlace (rol, nota, duración)
  App->>App: token = 256 bits al azar<br/>hash = SHA-256(token)
  App->>DB: insert invitations(token_hash, rol, vence)
  App-->>J: enlace /invitacion#token y QR
  J-->>I: comparte el enlace
  I->>App2: abre el enlace
  App2->>App2: lee el #fragmento y lo borra de la barra
  App2->>RI: check(token)
  RI->>DB: busca SHA-256(token) vigente
  RI-->>App2: válido + rol
  I->>App2: nombre, correo y contraseña
  App2->>RI: redeem(...)
  RI->>DB: marca usada (update ... where used_at is null)
  RI->>Auth: crea el usuario con ese rol
  RI-->>App2: ok
  App2->>Auth: inicia sesión
```

## Recuperación de contraseña

```mermaid
sequenceDiagram
  actor U as Persona
  participant App as SPA
  participant Auth as Supabase Auth
  participant Mail as Correo (SMTP)
  actor J as Juan
  participant AU as admin-users

  alt Por correo
    U->>App: Olvidé mi contraseña (correo)
    App->>Auth: resetPasswordForEmail
    Auth->>Mail: enlace /recuperar#token_hash
    Mail-->>U: correo
    App-->>U: mismo mensaje exista o no la cuenta
  else Sin correo
    J->>App: 🔑 en Usuarios
    App->>AU: recovery_link(userId)
    AU->>Auth: generateLink(recovery)
    AU-->>App: token_hash
    App-->>J: enlace y QR
    J-->>U: los comparte
  end
  U->>App: abre /recuperar#token_hash
  App->>Auth: verifyOtp(recovery, token_hash)
  Auth-->>App: sesión temporal
  U->>App: contraseña nueva (10+ caracteres)
  App->>Auth: updateUser(password)
  App->>Auth: signOut(others)
  App-->>U: listo
```

## Subida de fotos

```mermaid
flowchart TD
  A["Elegir fotos, carpeta o arrastrar"] --> B["Leer fecha EXIF<br/>y huella SHA-256"]
  B --> C{"¿Huella ya existe?"}
  C -- "sí" --> SKIP["Se omite como repetida"]
  C -- "no" --> D["Pool de Web Workers"]
  D --> E["Orientar, quitar metadatos y GPS,<br/>reducir a 2048 px, WebP ~450 KB<br/>+ miniatura 480 px"]
  E --> Q["TaskQueue<br/>concurrencia 2, reintentos con backoff"]
  Q --> U["Storage: bucket privado photos"]
  U --> R["insert photos<br/>(mes de la foto, source_hash)"]
  R --> T["Trigger de auditoría"]
  R --> RT["Realtime refresca la galería"]
  Q -- "falla tras reintentos" --> F["Resumen: reintentar las que fallaron"]
```

## Notitas, chat y notificaciones

```mermaid
sequenceDiagram
  actor C as Camila
  participant A as SPA de Camila
  participant DB as Postgres
  participant RT as Realtime
  participant B as SPA de Juan
  participant SP as send-push
  participant SW as Service worker de Juan

  C->>A: escribe una notita o un mensaje
  A->>DB: insert notes / chat_messages (RLS)
  DB->>DB: trigger notify_new_* → insert notifications
  DB-->>RT: cambio publicado
  RT-->>B: nueva notificación y mensaje
  B->>B: campanita, contador y toast
  opt Pestaña en segundo plano
    B->>B: notificación del sistema
  end
  opt Celular con avisos activados
    DB->>SP: trigger notifications_push (pg_net + secreto de Vault)
    SP->>SW: Web Push (VAPID)
    SW-->>SW: muestra el aviso y abre el enlace al tocarlo
  end
```

## Chat: respuestas, conexión y vistos

```mermaid
sequenceDiagram
  actor J as Juan
  participant A as SPA de Juan
  participant DB as Postgres
  participant RT as Realtime
  participant B as SPA de Camila
  actor C as Camila

  loop cada 30 s con la app a la vista
    B->>DB: chat_presence(false)
    DB-->>RT: chat_reads.last_seen_at
    RT-->>A: «Camila · en línea»
  end
  J->>A: escribe y envía
  A->>DB: insert chat_messages
  A-->>J: ✓✓ entregado (Camila se conectó después)
  C->>B: abre el chat
  B->>DB: chat_presence(true)
  DB-->>RT: chat_reads.last_read_at
  RT-->>A: ✓✓ visto
  C->>B: desliza el mensaje o toca ↩
  B->>DB: insert chat_messages(body, reply_to)
  RT-->>A: respuesta con la cita
  Note over A: Si Camila cierra la app, sin latidos<br/>pasa a «últ. vez hace…»
```

```mermaid
stateDiagram-v2
  [*] --> Enviando: enviar
  Enviando --> NoEnviado: error
  Enviando --> Enviado: guardado
  Enviado --> Entregado: la otra persona se conecta
  Entregado --> Visto: abre el chat
  Enviado --> Visto: abre el chat
```

## Chat: fotos y stickers

```mermaid
sequenceDiagram
  actor J as Juan
  participant A as SPA de Juan
  participant S as Storage chat-media
  participant DB as Postgres
  participant RT as Realtime
  participant B as SPA de Camila

  J->>A: 📷 elige fotos y escribe un mensaje
  A->>A: ImageProcessor: achica, quita metadatos, miniatura
  A-->>J: burbuja «Enviando foto…» con la vista previa
  A->>S: sube juan_id/id.webp y id.thumb.webp
  A->>DB: insert chat_messages(kind=image, rutas, body)
  alt el insert falla
    A->>S: borra lo que subió
    A-->>J: «No se envió»
  end
  DB-->>RT: mensaje nuevo
  RT-->>B: llega la foto
  B->>S: URL firmada de la miniatura
  Note over B: Al tocarla pide la foto grande
  J->>A: 😊 toca un sticker
  A->>DB: insert chat_messages(kind=sticker, sticker=id)
  RT-->>B: se dibuja con el catálogo de la app
```

## Tutorial guiado

```mermaid
stateDiagram-v2
  [*] --> Cerrado
  Cerrado --> Abierto: clic en «? Tutorial»
  state Abierto {
    [*] --> Paso
    Paso --> Paso: Siguiente / →
    Paso --> Paso: Anterior / ←
  }
  Abierto --> Cerrado: Cerrar, ✕ o Esc
  Abierto --> Cerrado: Terminar (último paso)
  Abierto --> Cerrado: cambio de página
```

```mermaid
flowchart LR
  R["Ruta actual + AccessPolicy"] --> T["tourFor()<br/>pasos de la página + menú permitido"]
  T --> O{"¿Paso opcional<br/>sin destino?"}
  O -- "sí" --> SKIP["Se omite"]
  O -- "no" --> F["Primer destino visible<br/>data-tour o ☰ en móvil"]
  F --> L["tourLayout<br/>resaltado + posición de la tarjeta"]
```

## Integración y despliegue

```mermaid
flowchart LR
  DEV["Commit en una rama"] --> PR["Pull request"]
  PR --> CI["CI<br/>typecheck · lint · pruebas · build"]
  CI -- "verde" --> M["Merge a master"]
  M --> D1["Deploy: pruebas otra vez"]
  D1 --> D2["Migraciones en Supabase"]
  D2 --> D3["Configurar Auth<br/>URLs, registro cerrado, SMTP"]
  D3 --> D4["Publicar Edge Functions"]
  D4 --> REL["release.mjs<br/>SemVer desde los commits"]
  REL --> TAG["Tag vX.Y.Z + release con notas"]
  M --> NET["Netlify<br/>build con tags y publicación"]
  NET --> WEB["Sitio con la versión en el pie"]
```

## Modelo de datos

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "tiene"
  PROFILES }o--|| ROLE : "rol"
  ROLE ||--o{ ROLE_PERMISSIONS : "concede"
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : "en"
  PROFILES ||--o{ INVITATIONS : "crea"
  AUTH_USERS ||--o| INVITATIONS : "usa"
  AUTH_USERS ||--o{ NOTES : "envía / recibe"
  AUTH_USERS ||--o{ CHAT_MESSAGES : "escribe"
  AUTH_USERS ||--o| CHAT_READS : "conexión y vistos"
  CHAT_MESSAGES |o--o{ CHAT_MESSAGES : "responde a"
  AUTH_USERS ||--o{ NOTIFICATIONS : "recibe"
  AUTH_USERS ||--o{ PUSH_SUBSCRIPTIONS : "dispositivos"
  AUTH_USERS ||--o{ INTERRUPTION_VIEWS : "vio"
  INTERRUPTIONS ||--o{ INTERRUPTION_VIEWS : "vista por"
  PHOTOS ||--o{ MILESTONES : "ilustra"
  AUTH_USERS ||--o{ AUDIT_LOG : "actor"

  PROFILES {
    uuid id PK
    text display_name
    app_role role
    boolean is_active
    jsonb theme_colors "colores propios"
  }
  PERMISSIONS {
    text key PK
    text description
  }
  ROLE_PERMISSIONS {
    app_role role PK
    text permission PK
  }
  INVITATIONS {
    uuid id PK
    text token_hash "SHA-256"
    app_role role "nunca super_admin"
    timestamptz expires_at
    timestamptz used_at
  }
  SITE_SETTINGS {
    smallint id PK "siempre 1"
    text site_title
    date relationship_start
    boolean is_public
    jsonb theme
  }
  SECTIONS {
    uuid id PK
    section_kind kind
    jsonb content
    int position
    boolean is_visible
  }
  PHOTOS {
    uuid id PK
    text storage_path
    text thumb_path
    date taken_on
    text source_hash "SHA-256"
  }
  MILESTONES {
    uuid id PK
    text title
    date happened_on
    uuid photo_id FK
  }
  IMPORTANT_DATES {
    uuid id PK
    text title
    date event_date
    boolean recurs_yearly
  }
  INTERRUPTIONS {
    uuid id PK
    text title
    interruption_style style
    timestamptz starts_at
    boolean show_once
  }
  NOTES {
    uuid id PK
    uuid sender_id FK
    uuid recipient_id FK
    note_kind kind
    timestamptz read_at
  }
  CHAT_MESSAGES {
    uuid id PK
    uuid sender_id FK
    chat_kind kind "text, image, sticker"
    text body
    uuid reply_to FK "mensaje citado"
    text image_path "chat-media/<user_id>/..."
    text thumb_path
    text sticker "id del catálogo"
  }
  CHAT_READS {
    uuid user_id PK
    timestamptz last_seen_at "última conexión"
    timestamptz last_read_at "hasta dónde leyó"
  }
  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    text kind "note, chat, system"
    text link
    timestamptz read_at
  }
  AUDIT_LOG {
    bigint id PK
    uuid actor_id FK
    text action
    text table_name
    jsonb old_data
    jsonb new_data
  }
```

`ROLE` representa el tipo enumerado `app_role` (`super_admin`, `editor`,
`viewer`), no una tabla. `SITE_SETTINGS`, `SECTIONS` e `IMPORTANT_DATES` no
tienen relaciones fuertes: los lee cualquiera con `site.view`.

## Roles y permisos

```mermaid
flowchart LR
  subgraph super_admin["super_admin (Juan)"]
    ALL["todos los permisos"]
  end
  subgraph editor["editor (Camila)"]
    E1["site.view"]
    E2["content.edit"]
    E3["photos.manage"]
    E4["dates.manage"]
    E5["interruptions.manage"]
    E6["notes.send"]
    E7["chat.use"]
  end
  subgraph viewer["viewer (invitado)"]
    V1["site.view"]
    V2["notes.send"]
    V3["chat.use"]
  end
  ALL --> SUPER["/super: usuarios, permisos,<br/>apariencia, secciones, ajustes, auditoría"]
  E2 & E3 & E4 & E5 --> PANEL["/panel"]
  E6 & V2 --> MSG["/mensajes"]
  E7 & V3 --> CHAT["/chat"]
```

Estos son los permisos por defecto (migración `core_schema`). Juan los cambia
en **Administración → Roles y permisos** y la base de datos los aplica al
instante.
