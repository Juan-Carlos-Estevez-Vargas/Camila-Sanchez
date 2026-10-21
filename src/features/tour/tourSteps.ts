/**
 * Pasos del tutorial guiado.
 *
 * Funciones puras: dada la página actual y lo que la persona puede hacer,
 * devuelven el recorrido. El componente GuidedTour sólo los dibuja, así que
 * todo lo que decide qué se enseña se prueba sin navegador.
 */
import { PERMISSIONS, type AccessPolicy } from "@/domain/permissions";

export interface TourStep {
  id: string;
  /**
   * Selectores CSS del elemento a resaltar, en orden de preferencia: se usa
   * el primero que esté visible (en móvil, el menú ☰ en vez del enlace).
   * Sin destino, el paso se muestra centrado.
   */
  target?: string[];
  /** Si su destino no existe en la página, el paso se omite. */
  optional?: boolean;
  /** Se añade al texto cuando se resalta un destino alternativo (no el primero). */
  fallbackNote?: string;
  title: string;
  body: string;
}

export interface TourContext {
  pathname: string;
  loggedIn: boolean;
  displayName?: string | null;
  policy: Pick<AccessPolicy, "can" | "canUseContentPanel" | "canUseSuperPanel">;
}

/** Selector del atributo `data-tour` que marca los destinos del recorrido. */
export const tourTarget = (name: string) => `[data-tour="${name}"]`;

/** Un enlace de la cabecera, o el botón ☰ cuando el menú está plegado. */
const navTarget = (name: string) => [tourTarget(name), tourTarget("menu")];
const MENU_NOTE = "En el celular lo encuentras al abrir el menú ☰.";

/** Sección privada a la que pertenece una ruta (para no repetirla en el menú). */
function areaOf(pathname: string): string {
  const [, first = ""] = pathname.split("/");
  return first;
}

const PANEL_PAGES: Record<string, { title: string; body: string }> = {
  "/panel": {
    title: "Tu panel",
    body: "Desde aquí cambias todo lo que se ve en la página: fotos, textos, hitos, fechas y sorpresas. Cada cambio se guarda y se ve al instante.",
  },
  "/panel/fotos": {
    title: "Fotos",
    body: "Sube una foto o muchas a la vez (arrástralas al recuadro). Se optimizan solas antes de subir y las repetidas se detectan. Arrastra las tarjetas para cambiar su orden.",
  },
  "/panel/textos": {
    title: "Textos y animaciones",
    body: "Edita el título, el subtítulo y el texto de cada sección, y elige con qué animación aparece al hacer scroll.",
  },
  "/panel/hitos": {
    title: "Hitos",
    body: "Los momentos importantes de la historia, con su fecha y una foto opcional. Aparecen como una línea de tiempo en la página.",
  },
  "/panel/fechas": {
    title: "Fechas importantes",
    body: "Aniversarios y cumpleaños. La página muestra una cuenta regresiva hacia la próxima fecha.",
  },
  "/panel/sorpresas": {
    title: "Sorpresas",
    body: "Mensajes que aparecen en una ventanita cuando la otra persona entra a la página. Puedes elegir si se muestran una sola vez.",
  },
};

const SUPER_PAGES: Record<string, { title: string; body: string }> = {
  "/super": {
    title: "Administración",
    body: "El resumen del sitio en cifras. Toca una tarjeta para ir a esa parte.",
  },
  "/super/usuarios": {
    title: "Usuarios",
    body: "Crea cuentas, invita con un enlace o un código QR, cambia roles, desactiva cuentas y genera con 🔑 un enlace para que alguien recupere su contraseña sin depender del correo.",
  },
  "/super/permisos": {
    title: "Roles y permisos",
    body: "Decide qué puede hacer cada rol. La base de datos vuelve a comprobar cada permiso, así que esconder un botón nunca es la única protección.",
  },
  "/super/apariencia": {
    title: "Apariencia",
    body: "Colores de la página (los que ve quien entra sin cuenta), tipografías, bordes, modo oscuro y efectos animados.",
  },
  "/super/secciones": {
    title: "Secciones",
    body: "Agrega, ordena, oculta o quita las secciones de la página principal.",
  },
  "/super/ajustes": {
    title: "Ajustes del sitio",
    body: "Título, fecha de inicio de la relación, música de fondo y si la página es pública o sólo para quien tiene cuenta.",
  },
  "/super/auditoria": {
    title: "Auditoría",
    body: "Quién cambió qué y cuándo. Los mensajes privados no se registran.",
  },
};

function adminSteps(pathname: string, pages: Record<string, { title: string; body: string }>, menuBody: string): TourStep[] {
  const path = pathname.replace(/\/+$/, "");
  const page = pages[path];
  return [
    { id: "admin-nav", target: [tourTarget("admin-nav")], title: "Menú del panel", body: menuBody },
    ...(page ? [{ id: "admin-page", target: [".admin-page__header", tourTarget("admin-main")], ...page }] : []),
  ];
}

/** Pasos propios de la página en la que está la persona. */
function pageSteps(ctx: TourContext): TourStep[] {
  const { pathname } = ctx;
  if (pathname === "/") {
    return [
      {
        id: "site",
        target: [tourTarget("site")],
        title: "Nuestra historia",
        body: "Desplázate hacia abajo: fotos, contadores, hitos, fechas y notitas. Toca una foto para verla en grande.",
      },
      {
        id: "music",
        target: [tourTarget("music")],
        optional: true,
        title: "Música",
        body: "Pon o pausa la canción de fondo cuando quieras.",
      },
    ];
  }
  if (pathname === "/entrar") {
    return [
      {
        id: "login-form",
        target: [tourTarget("login-form")],
        title: "Entrar",
        body: "Escribe tu correo y tu contraseña. Si estás en un computador compartido, desmarca «Mantener la sesión» para que se cierre al cerrar la pestaña.",
      },
      {
        id: "login-modes",
        target: [tourTarget("login-modes")],
        title: "Otras formas de entrar",
        body: "Puedes pedir un enlace mágico al correo o recuperar tu contraseña si la olvidaste.",
      },
    ];
  }
  if (pathname === "/invitacion") {
    return [{
      id: "invite",
      target: [".gate__card"],
      title: "Tu invitación",
      body: "Elige tu nombre y una contraseña de al menos 10 caracteres. La invitación sólo sirve una vez y caduca.",
    }];
  }
  if (pathname === "/recuperar") {
    return [{
      id: "recover",
      target: [".gate__card"],
      title: "Nueva contraseña",
      body: "Escribe tu nueva contraseña dos veces. Al guardarla se cierran tus sesiones en los demás dispositivos.",
    }];
  }
  if (pathname === "/mensajes") {
    return [
      {
        id: "notes-push",
        target: [tourTarget("push")],
        optional: true,
        title: "Avisos",
        body: "Activa los avisos para enterarte al instante cuando te escriban, aunque la página esté cerrada.",
      },
      {
        id: "notes-tabs",
        target: [tourTarget("notes-tabs")],
        title: "La cajita",
        body: "Recibidas, Enviadas y Escribir. Elige el tipo de notita (carta, perdón, te amo…), escríbela y llega con un aviso.",
      },
    ];
  }
  if (pathname === "/chat") {
    return [
      {
        id: "chat-presence",
        target: [tourTarget("chat-presence")],
        optional: true,
        title: "¿Está conectado?",
        body: "Aquí ves si la otra persona está «en línea» o hace cuánto se conectó por última vez.",
      },
      {
        id: "chat-thread",
        target: [tourTarget("chat-thread")],
        title: "La conversación",
        body: "Los mensajes llegan en tiempo real. En los tuyos, ✓ es enviado, ✓✓ entregado y ✓✓ de color, visto. Para responder uno, toca ↩ o deslízalo hacia la derecha.",
      },
      {
        id: "chat-composer",
        target: [tourTarget("chat-composer")],
        title: "Escribir",
        body: "Escribe y pulsa Enter para enviar. Con Mayúsculas + Enter haces un salto de línea, y con Esc dejas de responder a un mensaje.",
      },
      {
        id: "chat-photo",
        target: [tourTarget("chat-photo")],
        title: "Fotos",
        body: "Con 📷 eliges una o varias fotos (hasta 10) y puedes añadirles un mensaje. También puedes pegar una imagen directamente en el cuadro de texto.",
      },
      {
        id: "chat-sticker",
        target: [tourTarget("chat-sticker")],
        title: "Stickers",
        body: "Con 😊 abres los stickers. Toca uno y se envía al instante.",
      },
    ];
  }
  if (pathname === "/listas") {
    return [
      {
        id: "lists-new",
        target: [tourTarget("lists-new")],
        title: "Nueva lista",
        body: "Crea una lista, ponle nombre e icono y elige con quién compartirla: una persona o varias. Les llega un aviso.",
      },
      {
        id: "lists-grid",
        target: [tourTarget("lists-grid")],
        optional: true,
        title: "Tus listas",
        body: "Cada tarjeta muestra con quién la compartes, cuánto llevan y la fecha más cercana. Tócala para abrirla.",
      },
    ];
  }
  if (areaOf(pathname) === "listas") {
    return [
      {
        id: "list-add",
        target: [tourTarget("list-add")],
        title: "Agregar tareas",
        body: "Escribe una tarea y pulsa Enter. A los demás de la lista les llega un aviso.",
      },
      {
        id: "list-tasks",
        target: [tourTarget("list-tasks")],
        optional: true,
        title: "Tachar y abrir",
        body: "Marca el círculo cuando esté hecha. Toca la tarea para agregarle descripción, fecha, quién se encarga, subtareas, materiales y fotos.",
      },
      {
        id: "list-settings",
        target: [tourTarget("list-settings")],
        title: "Ajustes",
        body: "Cambia el nombre o la fecha, suma o saca personas, o sal de la lista. Quien la creó también puede borrarla.",
      },
    ];
  }
  if (pathname === "/cuenta/colores") {
    return [
      {
        id: "my-colors",
        target: [tourTarget("my-colors")],
        title: "Tus colores",
        body: "Toca una paleta para probarla y guárdala. Sólo cambia lo que ves tú: los demás siguen con los suyos, y quien entra sin cuenta ve los de la página.",
      },
    ];
  }
  if (pathname === "/cuenta") {
    return [
      {
        id: "account-colors",
        target: [tourTarget("account-colors")],
        title: "Tus colores",
        body: "Elige con qué colores ves la app. Sólo cambia para ti.",
      },
      {
        id: "account-push",
        target: [tourTarget("account-push")],
        title: "Avisos en el celular",
        body: "Actívalos en cada dispositivo para que los mensajes, las notitas y las sorpresas te lleguen aunque la app esté cerrada. En iPhone, primero agrega la app a la pantalla de inicio.",
      },
      {
        id: "account-password",
        target: [tourTarget("account-password")],
        title: "Tu contraseña",
        body: "Cámbiala cuando quieras. Debe tener al menos 10 caracteres.",
      },
      {
        id: "account-sessions",
        target: [tourTarget("account-sessions")],
        title: "Tus sesiones",
        body: "Si entraste en un dispositivo que ya no usas, cierra la sesión en todos los dispositivos.",
      },
    ];
  }
  if (areaOf(pathname) === "panel") {
    return adminSteps(pathname, PANEL_PAGES, "Cada opción es una parte de la página que puedes cambiar. Sólo ves las que tu cuenta tiene permitidas.");
  }
  if (areaOf(pathname) === "super") {
    return adminSteps(pathname, SUPER_PAGES, "Usuarios, permisos, apariencia, secciones, ajustes y auditoría. Desde aquí también llegas al panel de contenido.");
  }
  return [];
}

/** Pasos del menú principal, según lo que la cuenta puede usar. */
function navSteps(ctx: TourContext): TourStep[] {
  const { policy, loggedIn } = ctx;
  const here = areaOf(ctx.pathname);
  if (!loggedIn) {
    return here === "entrar" ? [] : [{
      id: "nav-entrar",
      target: navTarget("nav-entrar"), fallbackNote: MENU_NOTE,
      title: "Entrar",
      body: "Con tu cuenta ves las partes privadas, la cajita de mensajes y el chat.",
    }];
  }
  const steps: TourStep[] = [];
  if (policy.can(PERMISSIONS.notesSend) && here !== "mensajes") {
    steps.push({ id: "nav-mensajes", target: navTarget("nav-mensajes"), fallbackNote: MENU_NOTE, title: "Cajita de mensajes", body: "Notitas que se guardan para siempre: cartas, perdones, «te amo» y sorpresas." });
  }
  if (policy.can(PERMISSIONS.chatUse) && here !== "chat") {
    steps.push({ id: "nav-chat", target: navTarget("nav-chat"), fallbackNote: MENU_NOTE, title: "Chat", body: "Para hablar en tiempo real. El punto te avisa de mensajes sin leer." });
  }
  if (policy.can(PERMISSIONS.listsUse) && here !== "listas") {
    steps.push({ id: "nav-listas", target: navTarget("nav-listas"), fallbackNote: MENU_NOTE, title: "Listas", body: "Cosas por hacer con alguien más: tareas, subtareas, materiales, fotos y fechas." });
  }
  if (policy.canUseContentPanel && here !== "panel") {
    steps.push({ id: "nav-panel", target: navTarget("nav-panel"), fallbackNote: MENU_NOTE, title: "Mi panel", body: "Aquí cambias las fotos, los textos, los hitos, las fechas y las sorpresas." });
  }
  if (policy.canUseSuperPanel && here !== "super") {
    steps.push({ id: "nav-super", target: navTarget("nav-super"), fallbackNote: MENU_NOTE, title: "Administración", body: "Usuarios, invitaciones, permisos, apariencia y auditoría de todo el sitio." });
  }
  steps.push({ id: "bell", target: [tourTarget("bell")], title: "Notificaciones", body: "La campanita cuenta lo que no has leído. Tócala para ver cada aviso e ir directo a él." });
  if (here !== "cuenta") {
    steps.push({ id: "nav-cuenta", target: navTarget("nav-cuenta"), fallbackNote: MENU_NOTE, title: "Mi cuenta", body: "Cambia tu contraseña y cierra sesión en otros dispositivos." });
  }
  return steps;
}

/** Recorrido completo para la página actual. */
export function tourFor(ctx: TourContext): TourStep[] {
  const name = ctx.displayName?.trim();
  const welcome: TourStep = {
    id: "welcome",
    title: name ? `¡Hola, ${name}! 💖` : "¡Bienvenido! 💖",
    body: "Te enseño cómo usar esta página en unos pocos pasos. Usa Siguiente y Anterior (o las flechas del teclado) y Cerrar o Esc para salir cuando quieras.",
  };
  const farewell: TourStep = {
    id: "launcher",
    target: [tourTarget("tour-launcher")],
    title: "Siempre a mano",
    body: "Este botón vive en todas las páginas. Tócalo cuando quieras repetir el recorrido: cada página tiene sus propios pasos.",
  };
  return [welcome, ...pageSteps(ctx), ...navSteps(ctx), farewell];
}
