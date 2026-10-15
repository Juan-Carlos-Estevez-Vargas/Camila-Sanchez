import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";

export function LoveNotes({ section }: SectionProps<"love_notes">) {
  const cards = section.content.cards;
  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="notes-grid">
        {cards.map((card, i) => (
          <article key={i} className="love-card card card--interactive" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="love-card__icon" aria-hidden>{card.icon}</div>
            <h3>{card.title}</h3>
            <p className="muted">{card.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
