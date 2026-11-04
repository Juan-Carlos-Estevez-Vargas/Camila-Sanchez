import { useEffect, useState } from "react";
import { elapsedSince, parseIsoDate } from "@/domain/dates";
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
  const now = useNow(1000);
  const t = elapsedSince(start, now);
  const texts = useT().site.counter;
  const [d, h, m, s] = texts.units;
  const units: Array<[number, string]> = [[t.days, d ?? ""], [t.hours, h ?? ""], [t.minutes, m ?? ""], [t.seconds, s ?? ""]];
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() - (now.getDate() < start.getDate() ? 1 : 0);
  return (
    <>
      <div className="counter" role="timer" aria-live="off">
        {units.map(([value, label]) => (
          <div key={label} className="counter__box">
            <span className="counter__value">{formatNumber(value)}</span>
            <span className="counter__label">{label}</span>
          </div>
        ))}
      </div>
      {months > 0 && <p className="center muted">{texts.months(months)}</p>}
    </>
  );
}

export function TogetherCounter({ section, content }: SectionProps<"together_counter">) {
  const start = content.settings.relationshipStart;
  if (!start) return null;
  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <Ticker start={parseIsoDate(start)} />
    </div>
  );
}
