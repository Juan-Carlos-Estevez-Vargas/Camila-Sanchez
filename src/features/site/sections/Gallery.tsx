import { useMemo, useState } from "react";
import { groupPhotosByYearMonth, MONTH_ICONS, monthName } from "@/domain/dates";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { SectionHeading } from "./SectionHeading";
import { Lightbox } from "./Lightbox";
import type { SectionProps } from "./types";
import { useT } from "@/i18n";

/** Efecto especial al abrir algunos meses (como en la versión original). */
const MONTH_EFFECTS: Partial<Record<number, string[]>> = {
  1: ["❤️", "💖", "💘"],
  3: ["💧", "🌧️"],
  6: ["☀️", "🌞"],
  9: ["🎃", "👻"],
  11: ["❄️", "🎄", "✨"],
};

const preloaded = new Set<string>();
function preload(url: string | undefined) {
  if (!url || preloaded.has(url)) return;
  preloaded.add(url);
  new Image().src = url;
}

export function Gallery({ section, content, photoUrls }: SectionProps<"gallery">) {
  const years = useMemo(() => groupPhotosByYearMonth(content.photos), [content.photos]);
  const [yearIndex, setYearIndex] = useState(0);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const year = years[Math.min(yearIndex, years.length - 1)];
  const t = useT().site.gallery;

  if (!year) return null;
  const monthsWithPhotos = year.months.filter((m) => m.photos.length).length;
  const opened = openMonth != null ? year.months[openMonth] : undefined;

  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      {years.length > 1 && (
        <div className="tabs gallery__years" role="tablist" aria-label={t.years} onKeyDown={onRovingKeyDown}>
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
        {t.summary(year.total, monthsWithPhotos, year.year)}
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
              // Al acercar el ratón o el dedo ya se pide la primera foto grande.
              onPointerEnter={() => preload(cover?.full)}
              onFocus={() => preload(cover?.full)}
              aria-label={t.monthLabel(monthName(m.month), m.photos.length)}
            >
              {cover && <img className="month__cover" src={cover.thumb} alt="" loading="lazy" decoding="async" />}
              <span className="month__shade" aria-hidden />
              <span className="month__icon" aria-hidden>{MONTH_ICONS[m.month]}</span>
              <span className="month__name">{monthName(m.month)}</span>
              <span className="month__count">{empty ? t.empty : t.memories(m.photos.length)}</span>
            </button>
          );
        })}
      </div>
      </div>
      {opened && (
        <Lightbox
          title={`${monthName(opened.month)} ${year.year}`}
          photos={opened.photos}
          urls={photoUrls}
          effect={MONTH_EFFECTS[opened.month] ?? ["✨", "💖"]}
          onClose={() => setOpenMonth(null)}
        />
      )}
    </div>
  );
}
