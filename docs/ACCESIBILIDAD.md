# Accesibilidad (WCAG 2.2 AA) y SEO

La app busca que cualquiera pueda usarla: con teclado, con lector de
pantalla (NVDA, VoiceOver, TalkBack), con zoom, en alto contraste o
pidiendo menos movimiento. De paso, eso ayuda a los buscadores: una página
con buena estructura, títulos claros y textos alternativos es también una
página que Google entiende mejor.

## Cómo se cubre cada punto

| Criterio WCAG | Qué hace la app | Dónde |
| --- | --- | --- |
| 1.1.1 Contenido no textual | Fotos con `alt` (el mensaje del recuerdo); iconos y emojis decorativos con `aria-hidden`; botones de solo icono con nombre accesible | `Lightbox.tsx`, `ChatPage.tsx`, `Avatar.tsx` |
| 1.3.1 Información y relaciones | Encabezados en orden (un `h1` por página), regiones `main`/`nav`/`header`/`footer`, secciones con nombre, tablas con cabeceras | `SitePage.tsx`, `Reveal.tsx`, `AppHeader.tsx` |
| 1.3.5 Propósito de los campos | `autocomplete` en correo, nombre y contraseñas | `LoginPage.tsx`, `InvitePage.tsx` |
| 1.4.3 / 1.4.11 Contraste | Las paletas cumplen 4.5:1; si alguien elige colores a mano, `readableColors` corrige texto, enlaces, botones (4.5:1) y anillo de foco (3:1) | `domain/accessibleColors.ts`, `ThemeController.tsx` |
| 1.4.12 Espaciado del texto | Sin alturas fijas en textos; palabras largas se parten | `_typography.scss` |
| 2.1.1 / 2.1.2 Teclado | Todo se usa con teclado; pestañas y grupos de opciones con flechas, Inicio y Fin; diálogos atrapan el foco y Esc los cierra | `ui/rovingFocus.ts`, `ui/useFocusTrap.ts` |
| 2.2.1 Tiempo ajustable | Los avisos (toasts) se pausan con el mouse o el foco encima | `ToastContext.tsx` |
| 2.2.2 / 2.3.3 Pausar animaciones | Interruptor "Reducir animaciones" en el pie (además de respetar `prefers-reduced-motion`) | `ui/motion.ts`, `AppFooter.tsx` |
| 2.4.1 Saltar bloques | "Saltar al contenido" funciona en todas las páginas | `RouteAnnouncer.tsx` |
| 2.4.2 / 2.4.3 Títulos y orden del foco | Cada ruta tiene su título; al navegar, el foco va al `h1` y el lector anuncia la página nueva | `SeoController.tsx`, `RouteAnnouncer.tsx` |
| 2.4.7 / 2.4.11 Foco visible y no tapado | Anillo sólido con contraste garantizado; la cabecera fija nunca tapa lo enfocado (`scroll-padding-top`) | `_reset.scss`, `_mixins.scss` |
| 2.5.8 Tamaño del objetivo | Botones de al menos 34 px (iconos de 40 px) | `_button.scss` |
| 3.3.1 / 3.3.2 Errores y etiquetas | Cada campo tiene etiqueta; ayudas y errores se leen con el campo (`aria-describedby`, `aria-invalid`) | `ui/Field.tsx` |
| 4.1.2 Nombre, función, valor | Menú, campana, música y pestañas con `aria-expanded`, `aria-pressed`, `aria-selected`; sin controles anidados | `AppHeader.tsx`, `BulkUploadPanel.tsx` |
| 4.1.3 Mensajes de estado | Errores con `role="alert"`, avisos con `role="status"`, chat como `role="log"`, contadores sin leer dichos en palabras | `ToastContext.tsx`, `ChatPage.tsx` |

También se respeta el modo de alto contraste de Windows (`forced-colors`).

## SEO

- Título, descripción, canónica, Open Graph y Twitter por ruta (`core/seo.ts`).
- Imagen para redes con texto alternativo (`og:image:alt`, `twitter:image:alt`).
- Datos estructurados `WebSite` con idioma `es-CO`, imagen y autor.
- `robots.txt` y `sitemap.xml` generados en el build; las zonas privadas
  (`/entrar`, `/cuenta`, `/listas`, `/panel`, `/super`, `/chat`…) llevan
  `noindex` en la página y en la cabecera `X-Robots-Tag` (Netlify y Vercel).
  Una prueba vigila que ninguna ruta privada quede sin esa cabecera.
- `index.html` muestra "Cargando…" mientras arranca JavaScript, para que
  nunca se vea una página vacía.

## Cómo comprobarlo

- `npm run check`: tipos, lint y pruebas (incluye contraste y cabeceras).
- Revisión automática con [axe-core](https://github.com/dequelabs/axe-core)
  (reglas WCAG 2.0, 2.1 y 2.2 A/AA y buenas prácticas) en todas las rutas,
  en escritorio y móvil, con diálogos abiertos: 0 fallas.
- A mano: recorrer cada página sólo con Tab, Shift+Tab, Enter, Esc y
  flechas; y con un lector de pantalla.
