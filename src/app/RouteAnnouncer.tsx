import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const MAIN = "#contenido-principal, main";

/** Lleva el foco al contenido principal (o a su título) sin saltos raros. */
export function focusMain(preferHeading: boolean): boolean {
  const main = document.querySelector<HTMLElement>(MAIN);
  if (!main) return false;
  const target = (preferHeading && main.querySelector<HTMLElement>("h1")) || main;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  return true;
}

/**
 * En una SPA cambiar de página no recarga nada, así que el lector de
 * pantalla no se entera. Al navegar, esto anuncia el título nuevo y mueve
 * el foco al encabezado principal (WCAG 2.4.3, 4.1.3). La primera carga se
 * deja tal cual: el navegador ya la anuncia.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let tries = 0;
    let timer = 0;
    // Las páginas se cargan diferidas: esperamos (poco) a que aparezca <main>.
    const attempt = () => {
      tries += 1;
      if (focusMain(true) || tries > 20) {
        setMessage(document.title);
        return;
      }
      timer = window.setTimeout(attempt, 100);
    };
    timer = window.setTimeout(attempt, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}

/** "Saltar al contenido": funciona aunque la página no tenga el id esperado. */
export function SkipLink() {
  return (
    <a
      className="skip-link"
      href="#contenido-principal"
      onClick={(e) => {
        if (focusMain(false)) {
          e.preventDefault();
          document.querySelector(MAIN)?.scrollIntoView();
        }
      }}
    >
      Saltar al contenido
    </a>
  );
}
