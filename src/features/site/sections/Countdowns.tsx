import { buildCountdowns, titleInSentence } from "@/domain/dates";
import { countdownDates } from "@/domain/relationship";
import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";
import { dateFormat, useT } from "@/i18n";

export function Countdowns({ section, content }: SectionProps<"countdowns">) {
  const t = useT().site.countdown;
  const dayFormat = dateFormat({ weekday: "long", day: "numeric", month: "long" });
  const countdowns = buildCountdowns(countdownDates(content.dates, content.settings));
  if (!countdowns.length) return null;
  return (
    <div className="container" id="fechas">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="countdowns">
        {countdowns.map((c) => (
          <article key={c.date.id} className={`countdown card card--interactive${c.days === 0 ? " is-today" : ""}`}>
            <div className="countdown__icon" aria-hidden>{c.date.icon}</div>
            <div className="countdown__days">
              {c.days === 0 ? t.today : <>{c.days}<small> {t.days(c.days)}</small></>}
            </div>
            <h3 className="countdown__title">
              {c.days === 0 ? c.date.title : t.until(titleInSentence(c.date.title))}
            </h3>
            <p className="muted countdown__date">
              {dayFormat.format(c.next)}
              {c.years ? t.years(c.years) : ""}
            </p>
            {c.date.message && <p className="countdown__message">{c.date.message}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
