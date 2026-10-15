import { buildCountdowns } from "@/domain/dates";
import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";

const dayFormat = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

export function Countdowns({ section, content }: SectionProps<"countdowns">) {
  const countdowns = buildCountdowns(content.dates);
  if (!countdowns.length) return null;
  return (
    <div className="container" id="fechas">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="countdowns">
        {countdowns.map((c) => (
          <article key={c.date.id} className={`countdown card card--interactive${c.days === 0 ? " is-today" : ""}`}>
            <div className="countdown__icon" aria-hidden>{c.date.icon}</div>
            <div className="countdown__days">
              {c.days === 0 ? "¡Hoy!" : <>{c.days}<small> {c.days === 1 ? "día" : "días"}</small></>}
            </div>
            <h3 className="countdown__title">
              {c.days === 0 ? c.date.title : `para ${c.date.title.toLowerCase()}`}
            </h3>
            <p className="muted countdown__date">
              {dayFormat.format(c.next)}
              {c.years ? ` · ${c.years} ${c.years === 1 ? "año" : "años"}` : ""}
            </p>
            {c.date.message && <p className="countdown__message">{c.date.message}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
