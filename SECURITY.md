# Política de seguridad

## Versiones con soporte

Sólo la versión desplegada desde la rama `master` (el último
[release](https://github.com/Juan-Carlos-Estevez-Vargas/Camila-Sanchez/releases))
recibe correcciones de seguridad.

| Versión | Soporte |
| --- | --- |
| Último release `2.x` | ✅ |
| Releases anteriores | ❌ |
| `legacy/` (versión 1, HTML estático) | ❌ |

## Cómo reportar una vulnerabilidad

**No abras un issue público** con los detalles de una vulnerabilidad.

1. Ve a la pestaña
   [**Security → Report a vulnerability**](https://github.com/Juan-Carlos-Estevez-Vargas/Camila-Sanchez/security/advisories/new)
   del repositorio y envía un reporte privado.
2. Incluye, si puedes:
   - qué parte se ve afectada (página, función de Supabase, política RLS,
     cabeceras, etc.);
   - los pasos para reproducirlo o una prueba de concepto;
   - el impacto que crees que tiene.

Si el reporte privado no está disponible, abre un issue pidiendo un canal de
contacto **sin incluir ningún detalle técnico**.

## Qué puedes esperar

- Confirmación de recibido en un máximo de **5 días**.
- Una evaluación inicial y un plan en un máximo de **14 días**.
- Aviso cuando la corrección esté publicada y crédito en las notas del release
  si así lo deseas.

## Alcance

Dentro del alcance: el código de este repositorio (aplicación web, migraciones
y políticas RLS, Edge Functions, flujos de GitHub Actions y cabeceras de
producción).

Fuera del alcance: ataques de denegación de servicio, ingeniería social,
vulnerabilidades de Supabase, Netlify o GitHub en sí mismos, y reportes
automáticos sin una prueba de impacto real.

Por favor, no accedas a datos de otras personas ni los modifiques mientras
investigas. Prueba en tu propio proyecto de Supabase o en el
[modo demo](README.md#inicio-rápido).

El modelo de amenazas y cómo se cubre cada riesgo del OWASP Top 10 está en
[docs/SEGURIDAD_OWASP.md](docs/SEGURIDAD_OWASP.md).
