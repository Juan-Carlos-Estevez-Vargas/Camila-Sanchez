# Guía de contribución

¡Gracias por tu interés! Este es un proyecto personal, así que los cambios
grandes conviene conversarlos primero en un issue.

## Reportar errores o proponer ideas

- Busca antes en los [issues](https://github.com/Juan-Carlos-Estevez-Vargas/Camila-Sanchez/issues)
  para no duplicar.
- Usa la plantilla que corresponda (error o mejora) y describe cómo
  reproducirlo, qué esperabas y qué pasó, con capturas si ayudan.
- Las vulnerabilidades **no** van en issues: sigue la
  [política de seguridad](SECURITY.md).

## Preparar el entorno

```bash
npm install
npm run dev     # modo demo, sin cuentas ni variables de entorno
```

Requisitos: Node.js 20 o superior. Para trabajar contra Supabase copia
`.env.example` a `.env.local` (nunca subas ese archivo ni claves).

## Flujo de trabajo

1. Crea una rama desde `master` con un nombre descriptivo, por ejemplo
   `feat/listas-recordatorios` o `fix/chat-scroll`.
2. Haz cambios pequeños y enfocados.
3. Antes de abrir el pull request, ejecuta:

   ```bash
   npm run check   # typecheck + lint + pruebas (incluidas las de RLS)
   npm run build
   ```

4. Abre el pull request contra `master` y completa la plantilla. CI debe
   quedar en verde para poder fusionar.

## Mensajes de commit

El número de versión y las notas de cada release se generan a partir de los
commits, así que se usa [Conventional Commits](https://www.conventionalcommits.org/es/):

```
<tipo>(<ámbito opcional>): <descripción en minúsculas>
```

| Tipo | Cuándo | Efecto en la versión |
| --- | --- | --- |
| `feat` | Funcionalidad nueva | Sube la versión menor |
| `fix` | Corrección de un error | Sube el parche |
| `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` | Lo demás | Sube el parche |
| `feat!` o `BREAKING CHANGE:` en el cuerpo | Cambio incompatible | Sube la versión mayor |

Ejemplos: `feat(chat): responder citando un mensaje`,
`fix(listas): ordenar tareas por fecha`.

`npm run release:preview` muestra la versión y las notas que saldrían.

## Estilo de código

- TypeScript estricto; evita `any`.
- La interfaz sólo habla con el puerto `Backend` (`src/data/ports.ts`); si
  agregas una operación, impleméntala en los dos adaptadores (Supabase y demo).
- Los permisos se validan en la base de datos con RLS: cada tabla o política
  nueva va en una migración en `supabase/migrations/` con su prueba en
  `supabase/tests/`. Después ejecuta `npm run db:setup-sql`.
- Estilos en SCSS con `@use "abstracts" as *;`, nombres BEM y los colores
  siempre como custom properties del tema.
- Textos de la interfaz en español y accesibles (WCAG 2.2 AA): etiquetas en
  los campos, foco visible y nada que dependa sólo del color.

Más detalle en el [manual de arquitectura](docs/ARQUITECTURA.md).
