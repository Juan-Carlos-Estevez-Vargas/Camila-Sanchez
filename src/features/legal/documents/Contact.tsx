import { DATA_CONTROLLER } from "@/domain/legal";
import { useT } from "@/i18n";

/** Cómo contactar al responsable: el correo si está configurado, si no, Juan directamente. */
export function Contact() {
  const t = useT().legal;
  return DATA_CONTROLLER.email
    ? <>{t.contactEmail} <a href={`mailto:${DATA_CONTROLLER.email}`}>{DATA_CONTROLLER.email}</a></>
    : <>{t.contactFallback(DATA_CONTROLLER.name)}</>;
}
