import { buildCountdowns, countdownLabel, formatLongDate } from "@/domain/dates";
import type { SectionProps } from "./types";
import { useT } from "@/i18n";

export function Hero({ section, content }: SectionProps<"hero">) {
  const t = useT().site;
  const { settings } = content;
  const next = buildCountdowns(content.dates)[0];
  return (
    <div className="hero">
      <div className="hero__glow" aria-hidden />
      <div className="container hero__inner">
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
