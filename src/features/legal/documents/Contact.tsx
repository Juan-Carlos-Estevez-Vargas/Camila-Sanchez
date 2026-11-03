import { DATA_CONTROLLER } from "@/domain/legal";

/** Cómo contactar al responsable: el correo si está configurado, si no, Juan directamente. */
export function Contact() {
  return DATA_CONTROLLER.email
    ? <>al correo <a href={`mailto:${DATA_CONTROLLER.email}`}>{DATA_CONTROLLER.email}</a></>
    : <>por el chat de la app o por las redes de {DATA_CONTROLLER.name} (enlaces en el pie de página)</>;
}
