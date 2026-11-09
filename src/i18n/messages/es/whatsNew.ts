/** Novedades de cada versión (las claves salen de domain/whatsNew.ts). */
export const whatsNew = {
  title: "✨ Novedades",
  version: (v: string) => `Versión ${v}`,
  intro: "Esto es lo nuevo desde la última vez que entraste:",
  historyIntro: "Todo lo que ha ido llegando a la app, de lo más nuevo a lo más viejo.",
  showTour: "Ver cómo funciona",
  also: "Además",
  close: "¡Entendido!",
  showHistory: "Ver todas las novedades",
  footerLink: "✨ Novedades",
  releases: {
    "2026-11-09": {
      news: {
        photoReplace: {
          title: "Cambiar una foto",
          body: "Si una foto se subió mal o se ve borrosa, cámbiala con 🔄 sin perder su mensaje, su fecha ni su lugar. Funciona en el álbum del panel y en tus dedicatorias.",
        },
        seenBy: {
          title: "Quién vio tu dedicatoria",
          body: "En tus dedicatorias ahora sabes quién ya la abrió y cuándo, y quién todavía no. En la lista verás 👀 Vista o cuántas personas la vieron.",
        },
        photoQuality: {
          title: "Fotos más nítidas",
          body: "Las fotos nuevas se guardan más grandes (hasta 2560 px), con un reescalado de mejor calidad y un toque de nitidez. Te avisamos con ⚠️ cuando una foto es demasiado chica.",
        },
      },
      changes: [
        "Las miniaturas del álbum, el chat, las listas y las dedicatorias se ven más definidas.",
        "Antes de enviar una dedicatoria puedes cambiar cualquiera de sus fotos.",
      ],
    },
    "2026-11-08": {
      news: {
        dedications: {
          title: "Dedicatorias con canciones y fotos",
          body: "Escríbele una carta a alguien (o a todos) con fotos y canciones de YouTube, Spotify o un audio tuyo. Todas las canciones forman una playlist que suena aquí mismo y que puedes llevar a otras apps.",
        },
        whatsNew: {
          title: "Esta ventana de novedades",
          body: "Cada vez que la app se actualice verás aquí lo que cambió, y con «Ver cómo funciona» te llevamos a probarlo. La encuentras de nuevo en el pie de página.",
        },
      },
      changes: [
        "El reproductor sigue sonando al cambiar de página y pausa la música de la portada.",
        "Importa canciones pegando enlaces o abriendo un archivo .m3u.",
      ],
    },
    "2026-11-05": {
      news: {
        received: {
          title: "Tus sorpresas se quedan",
          body: "Las sorpresas que te prepararon quedan guardadas en la Cajita → Recibidas para volver a verlas cuando quieras.",
        },
        audit: {
          title: "Auditoría más fácil de revisar",
          body: "Filtra por mes, sección, acción y persona, ordena y pasa de página sin perderte.",
        },
      },
      changes: [
        "El aviso de una sorpresa te lleva directo a la Cajita.",
      ],
    },
    "2026-11-04": {
      news: {
        languages: {
          title: "La app en tu idioma",
          body: "Español, inglés y portugués. Se abre en el idioma de tu celular y lo cambias con 🌐 en la cabecera.",
        },
        install: {
          title: "Instálala en tu celular",
          body: "Con su propio ícono, a pantalla completa y abre aunque no haya internet. Los pasos están en «Descarga la app», en el pie de página.",
        },
      },
      changes: [
        "Te avisamos cuando hay una versión nueva para actualizar con un toque.",
        "La cabecera y el pie se acomodan mejor en cualquier idioma.",
      ],
    },
    "2026-11-03": {
      news: {
        chat: {
          title: "Un chat de verdad",
          body: "Busca personas, envía solicitudes, responde, reacciona, edita, comparte fotos y stickers, y mira quién está en línea.",
        },
        surprises: {
          title: "Sorpresas para una sola persona",
          body: "Cada sorpresa se prepara para alguien: sólo esa persona la ve y le llega el aviso.",
        },
      },
      changes: [
        "Páginas legales claras y un aviso de cookies.",
      ],
    },
    "2026-10-21": {
      news: {
        lists: {
          title: "Listas compartidas",
          body: "Haz listas con otras personas: tareas, subtareas, materiales, fotos, fechas y quién se encarga, todo en vivo.",
        },
        profile: {
          title: "Tu perfil",
          body: "Cambia tu nombre, ponte una foto o un icono, una frase y tu cumpleaños.",
        },
      },
      changes: [
        "Avisos en la pantalla del celular, también desde el chat.",
      ],
    },
  },
};
