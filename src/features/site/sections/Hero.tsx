import { buildCountdowns, countdownLabel, formatLongDate } from "@/domain/dates";
import type { SectionProps } from "./types";
import { useT } from "@/i18n";
import { useSpecialDay } from "@/state/SpecialDayContext";

export function Hero({ section, content }: SectionProps<"hero">) {
  const t = useT().site;
  const ts = useT().special;
  const { day } = useSpecialDay();
  const { settings } = content;
  const next = buildCountdowns(content.dates)[0];
  return (
    <div className="hero">
      <div className="hero__glow" aria-hidden />
      <div className="container hero__inner">
        {day && (
          // El saludo del día (cumpleaños, Halloween, Navidad...) va antes que todo.
          <div className="hero__special" role="note">
            <span className="hero__special-icon" aria-hidden>{day.style.icon}</span>
            <p className="hero__special-title">
              {ts.greetings[day.id]({ name: settings.effects.specialDays.birthdayName.trim(), years: day.years })}
            </p>
            <p className="hero__special-text">{ts.taglines[day.id]}</p>
          </div>
        )}
        {settings.relationshipStart && (
          <span className="hero__eyebrow">{t.together(formatLongDate(settings.relationshipStart))}</span>
        )}
        <h1 className="hero__title">{section.title || settings.siteTitle}</h1>
        {(section.subtitle || settings.siteSubtitle) && (
          <p className="hero__subtitle">{section.subtitle || settings.siteSubtitle}</p>
        )}
        {next && (
          <a className="hero__chip" href="#fechas">
            <span aria-hidden>{next.date.icon}</span> {countdownLabel(next)}
          </a>
        )}
        <a className="hero__scroll" href="#contenido" aria-label={t.seeMore}>
          <span aria-hidden>↓</span>
        </a>
      </div>
    </div>
  );
}
