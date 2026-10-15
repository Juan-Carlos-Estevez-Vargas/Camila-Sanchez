export function SectionHeading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  if (!title && !subtitle) return null;
  return (
    <header className="section-heading">
      {eyebrow && <span className="section-heading__eyebrow">{eyebrow}</span>}
      {title && <h2>{title}</h2>}
      {subtitle && <p className="muted">{subtitle}</p>}
    </header>
  );
}
