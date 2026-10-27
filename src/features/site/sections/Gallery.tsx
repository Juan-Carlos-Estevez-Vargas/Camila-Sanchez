import { useMemo, useState } from "react";
import { groupPhotosByYearMonth, MONTH_ICONS, MONTH_NAMES } from "@/domain/dates";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { SectionHeading } from "./SectionHeading";
import { Lightbox } from "./Lightbox";
import type { SectionProps } from "./types";

/** Efecto especial al abrir algunos meses (como en la versión original). */
const MONTH_EFFECTS: Partial<Record<number, string[]>> = {
  1: ["❤️", "💖", "💘"],
  3: ["💧", "🌧️"],
  6: ["☀️", "🌞"],
  9: ["🎃", "👻"],
  11: ["❄️", "🎄", "✨"],
};

export function Gallery({ section, content, photoUrls }: SectionProps<"gallery">) {
  const years = useMemo(() => groupPhotosByYearMonth(content.photos), [content.photos]);
  const [yearIndex, setYearIndex] = useState(0);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const year = years[Math.min(yearIndex, years.length - 1)];

  if (!year) return null;
  const monthsWithPhotos = year.months.filter((m) => m.photos.length).length;
  const opened = openMonth != null ? year.months[openMonth] : undefined;

  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      {years.length > 1 && (
        <div className="tabs gallery__years" role="tablist" aria-label="Años" onKeyDown={onRovingKeyDown}>
          {years.map((y, i) => (
            <button key={y.year} id={`galeria-${y.year}`} role="tab" className="tab" aria-selected={i === yearIndex} aria-controls="galeria-meses"
              tabIndex={rovingTabIndex(i === yearIndex)} onClick={() => setYearIndex(i)}>
              {y.year}
            </button>
          ))}
        </div>
      )}
      <div id="galeria-meses" {...(years.length > 1 ? { role: "tabpanel", "aria-labelledby": `galeria-${year.year}` } : {})}>
      <p className="center muted gallery__summary">
        {year.total} {year.total === 1 ? "recuerdo" : "recuerdos"} en {monthsWithPhotos} {monthsWithPhotos === 1 ? "mes" : "meses"} de {year.year}
      </p>
      <div className="months">
        {year.months.map((m) => {
          const cover = m.photos[0] ? photoUrls.get(m.photos[0].id) : undefined;
          const empty = m.photos.length === 0;
          return (
            <button
              key={m.month}
              className={`month${empty ? " is-empty" : ""}`}
              disabled={empty}
              onClick={() => setOpenMonth(m.month)}
              aria-label={`${MONTH_NAMES[m.month]}: ${empty ? "sin fotos aún" : `${m.photos.length} ${m.photos.length === 1 ? "recuerdo" : "recuerdos"}, ver fotos`}`}
            >
              {cover && <img className="month__cover" src={cover.thumb} alt="" loading="lazy" decoding="async" />}
              <span className="month__shade" aria-hidden />
              <span className="month__icon" aria-hidden>{MONTH_ICONS[m.month]}</span>
              <span className="month__name">{MONTH_NAMES[m.month]}</span>
              <span className="month__count">{empty ? "Sin fotos aún" : `${m.photos.length} ${m.photos.length === 1 ? "recuerdo" : "recuerdos"}`}</span>
            </button>
          );
        })}
      </div>
      </div>
      {opened && (
        <Lightbox
          title={`${MONTH_NAMES[opened.month]} ${year.year}`}
          photos={opened.photos}
          urls={photoUrls}
          effect={MONTH_EFFECTS[opened.month] ?? ["✨", "💖"]}
          onClose={() => setOpenMonth(null)}
        />
      )}
    </div>
  );
}
