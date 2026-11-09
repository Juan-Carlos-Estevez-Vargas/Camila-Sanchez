import { useEffect, useState } from "react";
import { elapsedSince, formatLongDate, parseIsoDate } from "@/domain/dates";
import { counterUntil, relationshipEnded } from "@/domain/relationship";
import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";
import { formatNumber, useT } from "@/i18n";

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Sólo este componente se re-renderiza cada segundo, no toda la página. */
function Ticker({ start }: { start: Date }) {
  return <Counter start={start} now={useNow(1000)} ended={false} />;
}

/**
 * Los números del contador. Con la relación terminada (`ended`) se queda
 * quieto en el día del final: no hay reloj ni re-render cada segundo.
 */
function Counter({ start, now, ended }: { start: Date; now: Date; ended: boolean }) {
  const t = elapsedSince(start, now);
  const texts = useT().site.counter;
  const [d, h, m, s] = texts.units;
  const units: Array<[number, string]> = [[t.days, d ?? ""], [t.hours, h ?? ""], [t.minutes, m ?? ""], [t.seconds, s ?? ""]];
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() - (now.getDate() < start.getDate() ? 1 : 0);
  return (
    <>
      <div className="counter" role={ended ? undefined : "timer"} aria-live="off">
        {units.map(([value, label]) => (
          <div key={label} className="counter__box">
            <span className="counter__value">{formatNumber(value)}</span>
            <span className="counter__label">{label}</span>
          </div>
        ))}
      </div>
      {months > 0 && <p className="center muted">{ended ? texts.monthsEnded(months) : texts.months(months)}</p>}
    </>
  );
}

export function TogetherCounter({ section, content }: SectionProps<"together_counter">) {
  const { settings } = content;
  const texts = useT().site.counter;
  const start = settings.relationshipStart;
  if (!start) return null;
  const ended = relationshipEnded(settings);
  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      {ended ? (
        <>
          <Counter start={parseIsoDate(start)} now={counterUntil(settings)} ended />
          <p className="center muted">{texts.ended(formatLongDate(start), formatLongDate(settings.relationshipEnd!))}</p>
        </>
      ) : (
        <Ticker start={parseIsoDate(start)} />
      )}
    </div>
  );
}
