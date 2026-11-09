/**
 * Pasos del tutorial guiado.
 *
 * Funciones puras: dada la página actual y lo que la persona puede hacer,
 * devuelven el recorrido. El componente GuidedTour sólo los dibuja, así que
 * todo lo que decide qué se enseña se prueba sin navegador.
 */
import { PERMISSIONS, type AccessPolicy } from "@/domain/permissions";
import { msg } from "@/i18n";

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
const MENU_NOTE = () => msg().tour.menuNote;

/** Título y texto de un paso, en el idioma actual. */
const text = (id: string) => msg().tour.steps[id as keyof ReturnType<typeof msg>["tour"]["steps"]];

/** Sección privada a la que pertenece una ruta (para no repetirla en el menú). */
function areaOf(pathname: string): string {
  const [, first = ""] = pathname.split("/");
  return first;
}



function adminSteps(pathname: string, menuBody: string): TourStep[] {
  const pages = msg().tour.pages;
  const path = pathname.replace(/\/+$/, "");
  const page = pages[path];
  return [
    { id: "admin-nav", target: [tourTarget("admin-nav")], title: msg().tour.adminNav, body: menuBody },
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
        ...text("site"),
      },
      {
        id: "music",
        target: [tourTarget("music")],
        optional: true,
        ...text("music"),
      },
    ];
  }
  if (pathname === "/entrar") {
    return [
      {
        id: "login-form",
        target: [tourTarget("login-form")],
        ...text("login-form"),
      },
      {
        id: "login-modes",
        target: [tourTarget("login-modes")],
        ...text("login-modes"),
      },
    ];
  }
  if (pathname === "/invitacion") {
    return [{
      id: "invite",
      target: [".gate__card"],
      ...text("invite"),
    }];
  }
  if (pathname === "/recuperar") {
    return [{
      id: "recover",
      target: [".gate__card"],
      ...text("recover"),
    }];
  }
  if (pathname === "/mensajes") {
    return [
      {
        id: "notes-push",
        target: [tourTarget("push")],
        optional: true,
        ...text("notes-push"),
      },
      {
        id: "notes-tabs",
        target: [tourTarget("notes-tabs")],
        ...text("notes-tabs"),
      },
    ];
  }
  if (pathname === "/chat" || pathname === "/chat/solicitudes" || pathname === "/chat/personas") {
    return [
      {
        id: "chat-list",
        target: [tourTarget("chat-list")],
        ...text("chat-list"),
      },
      {
        id: "chat-new",
        target: [tourTarget("chat-new")],
        ...text("chat-new"),
      },
      {
        id: "chat-requests",
        target: [tourTarget("chat-requests")],
        ...text("chat-requests"),
      },
    ];
  }
  if (pathname.startsWith("/chat/")) {
    return [
      {
        id: "chat-presence",
        target: [tourTarget("chat-presence")],
        optional: true,
        ...text("chat-presence"),
      },
      {
        id: "chat-thread",
        target: [tourTarget("chat-thread")],
        ...text("chat-thread"),
      },
      {
        id: "chat-composer",
        target: [tourTarget("chat-composer")],
        ...text("chat-composer"),
      },
      {
        id: "chat-photo",
        target: [tourTarget("chat-photo")],
        ...text("chat-photo"),
      },
      {
        id: "chat-sticker",
        target: [tourTarget("chat-sticker")],
        ...text("chat-sticker"),
      },
      {
        id: "chat-menu",
        target: [tourTarget("chat-menu")],
        ...text("chat-menu"),
      },
    ];
  }
  if (pathname === "/listas") {
    return [
      {
        id: "lists-new",
        target: [tourTarget("lists-new")],
        ...text("lists-new"),
      },
      {
        id: "lists-grid",
        target: [tourTarget("lists-grid")],
        optional: true,
        ...text("lists-grid"),
      },
    ];
  }
  if (pathname === "/dedicatorias" || pathname === "/dedicatorias/playlist") {
    return [
      {
        id: "dedications-new",
        target: [tourTarget("dedications-new")],
        ...text("dedications-new"),
      },
      {
        id: "dedications-tabs",
        target: [tourTarget("dedications-tabs")],
        ...text("dedications-tabs"),
      },
      ...(pathname === "/dedicatorias/playlist" ? [{
        id: "dedication-play",
        target: [tourTarget("dedication-play")],
        optional: true,
        ...text("dedication-play"),
      }] : []),
    ];
  }
  if (areaOf(pathname) === "dedicatorias") {
    return [
      {
        id: "dedication-play",
        target: [tourTarget("dedication-play")],
        optional: true,
        ...text("dedication-play"),
      },
    ];
  }
  if (areaOf(pathname) === "listas") {
    return [
      {
        id: "list-add",
        target: [tourTarget("list-add")],
        ...text("list-add"),
      },
      {
        id: "list-tasks",
        target: [tourTarget("list-tasks")],
        optional: true,
        ...text("list-tasks"),
      },
      {
        id: "list-settings",
        target: [tourTarget("list-settings")],
        ...text("list-settings"),
      },
    ];
  }
  if (pathname === "/cuenta/perfil") {
    return [
      {
        id: "profile-photo",
        target: [tourTarget("profile-photo")],
        ...text("profile-photo"),
      },
      {
        id: "profile-icon",
        target: [tourTarget("profile-icon")],
        ...text("profile-icon"),
      },
      {
        id: "profile-details",
        target: [tourTarget("profile-details")],
        ...text("profile-details"),
      },
    ];
  }
  if (pathname === "/cuenta/colores") {
    return [
      {
        id: "my-colors",
        target: [tourTarget("my-colors")],
        ...text("my-colors"),
      },
    ];
  }
  if (pathname === "/cuenta") {
    return [
      {
        id: "account-profile",
        target: [tourTarget("account-profile")],
        ...text("account-profile"),
      },
      {
        id: "account-colors",
        target: [tourTarget("account-colors")],
        ...text("account-colors"),
      },
      {
        id: "account-language",
        target: [tourTarget("account-language")],
        ...text("account-language"),
      },
      {
        id: "account-push",
        target: [tourTarget("account-push")],
        ...text("account-push"),
      },
      {
        id: "account-password",
        target: [tourTarget("account-password")],
        ...text("account-password"),
      },
      {
        id: "account-two-step",
        target: [tourTarget("account-two-step")],
        ...text("account-two-step"),
      },
      {
        id: "account-sessions",
        target: [tourTarget("account-sessions")],
        ...text("account-sessions"),
      },
    ];
  }
  if (areaOf(pathname) === "panel") {
    return adminSteps(pathname, msg().tour.panelMenu);
  }
  if (areaOf(pathname) === "super") {
    return adminSteps(pathname, msg().tour.superMenu);
  }
  return [];
}

/** Pasos del menú principal, según lo que la cuenta puede usar. */
function navSteps(ctx: TourContext): TourStep[] {
  const { policy, loggedIn } = ctx;
  const here = areaOf(ctx.pathname);
  const language: TourStep = { id: "language", target: navTarget("language"), fallbackNote: MENU_NOTE(), ...text("language") };
  if (!loggedIn) {
    return here === "entrar" ? [language] : [{
      id: "nav-entrar",
      target: navTarget("nav-entrar"), fallbackNote: MENU_NOTE(),
      ...text("nav-entrar"),
    }, language];
  }
  const steps: TourStep[] = [];
  if (policy.can(PERMISSIONS.notesSend) && here !== "mensajes") {
    steps.push({ id: "nav-mensajes", target: navTarget("nav-mensajes"), fallbackNote: MENU_NOTE(), ...text("nav-mensajes") });
  }
  if (policy.can(PERMISSIONS.chatUse) && here !== "chat") {
    steps.push({ id: "nav-chat", target: navTarget("nav-chat"), fallbackNote: MENU_NOTE(), ...text("nav-chat") });
  }
  if (policy.can(PERMISSIONS.listsUse) && here !== "listas") {
    steps.push({ id: "nav-listas", target: navTarget("nav-listas"), fallbackNote: MENU_NOTE(), ...text("nav-listas") });
  }
  if (policy.can(PERMISSIONS.dedicationsUse) && here !== "dedicatorias") {
    steps.push({ id: "nav-dedicatorias", target: navTarget("nav-dedicatorias"), fallbackNote: MENU_NOTE(), ...text("nav-dedicatorias") });
  }
  if (policy.canUseContentPanel && here !== "panel") {
    steps.push({ id: "nav-panel", target: navTarget("nav-panel"), fallbackNote: MENU_NOTE(), ...text("nav-panel") });
  }
  if (policy.canUseSuperPanel && here !== "super") {
    steps.push({ id: "nav-super", target: navTarget("nav-super"), fallbackNote: MENU_NOTE(), ...text("nav-super") });
  }
  steps.push({ id: "bell", target: [tourTarget("bell")], ...text("bell") });
  if (here !== "cuenta") steps.push(language);
  if (here !== "cuenta") {
    steps.push({ id: "nav-cuenta", target: navTarget("nav-cuenta"), fallbackNote: MENU_NOTE(), ...text("nav-cuenta") });
  }
  return steps;
}

/** Recorrido completo para la página actual. */
export function tourFor(ctx: TourContext): TourStep[] {
  const t = msg().tour;
  const name = ctx.displayName?.trim();
  const welcome: TourStep = {
    id: "welcome",
    title: name ? t.hello(name) : t.welcome,
    body: t.welcomeBody,
  };
  const farewell: TourStep = {
    id: "launcher",
    target: [tourTarget("tour-launcher")],
    ...text("launcher"),
  };
  return [welcome, ...pageSteps(ctx), ...navSteps(ctx), farewell];
}

/**
 * Recorrido de una función nueva: su presentación (lo de las novedades),
 * los pasos de su página y el recordatorio del botón del tutorial.
 */
export function featureTour(ctx: TourContext, intro: { title: string; body: string }): TourStep[] {
  const farewell: TourStep = { id: "launcher", target: [tourTarget("tour-launcher")], ...text("launcher") };
  return [{ id: "whats-new", ...intro }, ...pageSteps(ctx), farewell];
}

/** ¿La página tiene pasos propios? (para no llevar a un tutorial vacío). */
export const hasPageTour = (ctx: TourContext): boolean => pageSteps(ctx).length > 0;
