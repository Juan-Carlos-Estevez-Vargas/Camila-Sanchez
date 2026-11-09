import { Link, useLocation } from "react-router-dom";
import { useSpecialDay } from "@/state/SpecialDayContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { useT } from "@/i18n";

/**
 * Franja bajo la cabecera en una fecha especial («🎃 ¡Feliz Halloween!»). En
 * la portada no sale si hay portada (el saludo grande ya está ahí) y nunca
 * en el chat, que ocupa toda la pantalla. En la vista previa sale siempre,
 * con el enlace para quitarla.
 */
export function SpecialDayRibbon() {
  const { day, preview } = useSpecialDay();
  const { content } = useSiteContent();
  const { pathname } = useLocation();
  const t = useT().special;
  if (!day) return null;
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;
  const heroOnHome = pathname === "/" && content?.sections.some((s) => s.kind === "hero" && s.isVisible);
  if (heroOnHome && !preview) return null;
  const greeting = t.greetings[day.id]({ name: content?.settings.effects.specialDays.birthdayName.trim() ?? "", years: day.years });
  return (
    <div className="special-ribbon" role="note">
      <div className="container special-ribbon__inner">
        <span aria-hidden>{day.style.icon}</span>
        <span>{preview ? t.preview(t.names[day.id]) : greeting}</span>
        {preview && <Link className="special-ribbon__link" to="?tema=normal">{t.removePreview}</Link>}
      </div>
    </div>
  );
}
