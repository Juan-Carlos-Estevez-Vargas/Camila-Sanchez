import { useState } from "react";
import { Modal } from "@/ui/Modal";
import { burst } from "../effects/FloatingEffects";
import { SectionHeading } from "./SectionHeading";
import type { SectionProps } from "./types";

export function Letter({ section }: SectionProps<"letter">) {
  const { greeting, paragraphs, wishes, signature, surprise } = section.content;
  const [open, setOpen] = useState(false);
  return (
    <div className="container">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <article className="letter">
        {greeting && <p className="letter__greeting">{greeting}</p>}
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        {wishes.length > 0 && (
          <ul className="letter__wishes">
            {wishes.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        {signature && <p className="letter__signature">{signature}</p>}
        {surprise && (
          <div className="center">
            <button className="btn" onClick={() => { setOpen(true); burst(["💖", "✨", "🎁", "💕"]); }}>
              🎁 {surprise.button}
            </button>
          </div>
        )}
      </article>
      {open && surprise && (
        <Modal title={surprise.title || "¡Sorpresa!"} onClose={() => setOpen(false)}>
          <p className="surprise-text">{surprise.text}</p>
        </Modal>
      )}
    </div>
  );
}

export function TextSection({ section }: SectionProps<"text">) {
  return (
    <div className="container container--narrow">
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      {section.content.body.split(/\n{2,}/).map((p, i) => <p key={i} className="prose">{p}</p>)}
    </div>
  );
}

export function Quote({ section }: SectionProps<"quote">) {
  return (
    <div className="container container--narrow">
      <figure className="quote">
        <blockquote>{section.content.text}</blockquote>
        {section.content.author && <figcaption>— {section.content.author}</figcaption>}
      </figure>
    </div>
  );
}
