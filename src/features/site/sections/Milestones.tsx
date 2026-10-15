import { formatLongDate } from "@/domain/dates";
import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";

export function Milestones({ section, content, photoUrls }: SectionProps<"milestones">) {
  const items = content.milestones;
  if (!items.length) return null;
  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <ol className="timeline">
        {items.map((m, i) => {
          const photo = m.photoId ? photoUrls.get(m.photoId) : undefined;
          return (
            <li key={m.id} className={`timeline__item ${i % 2 ? "is-right" : "is-left"}`}>
              <span className="timeline__dot" aria-hidden>{m.icon}</span>
              <article className="timeline__card card">
                <time className="timeline__date" dateTime={m.happenedOn}>{formatLongDate(m.happenedOn)}</time>
                <h3>{m.title}</h3>
                {m.description && <p className="muted">{m.description}</p>}
                {photo && <img className="timeline__photo" src={photo.thumb} alt="" loading="lazy" decoding="async" />}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
