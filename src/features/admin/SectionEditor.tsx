import { useState, type ReactNode } from "react";
import { SECTION_KIND_LABELS } from "@/domain/defaults";
import { SECTION_ANIMATIONS, type LoveNoteCard, type Section, type SectionAnimation, type SectionContentMap, type SectionKind } from "@/domain/types";
import { Field } from "@/ui/Field";

export const ANIMATION_LABELS: Record<SectionAnimation, string> = {
  none: "Sin animación",
  "fade-up": "Aparecer subiendo",
  "zoom-in": "Acercarse",
  "slide-left": "Entrar desde la izquierda",
  "slide-right": "Entrar desde la derecha",
  float: "Flotar suavemente",
  heartbeat: "Título que late",
};

type ContentEditor<K extends SectionKind> = (props: {
  value: SectionContentMap[K];
  onChange(value: SectionContentMap[K]): void;
}) => ReactNode;

function ListEditor({ label, items, onChange, placeholder, multiline }: {
  label: string;
  items: string[];
  onChange(items: string[]): void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {items.map((item, i) => (
        <div key={i} className="row" style={{ alignItems: "start" }}>
          {multiline ? (
            <textarea className="textarea grow" value={item} placeholder={placeholder} aria-label={`${label} ${i + 1}`}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          ) : (
            <input className="input grow" value={item} placeholder={placeholder} aria-label={`${label} ${i + 1}`}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Quitar" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--soft" style={{ justifySelf: "start" }} onClick={() => onChange([...items, ""])}>+ Agregar</button>
    </div>
  );
}

const LoveNotesEditor: ContentEditor<"love_notes"> = ({ value, onChange }) => {
  const update = (i: number, patch: Partial<LoveNoteCard>) =>
    onChange({ cards: value.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="stack">
      {value.cards.map((card, i) => (
        <div key={i} className="card stack" style={{ padding: 16 }}>
          <div className="row">
            <input className="input" style={{ width: 64, textAlign: "center" }} value={card.icon} maxLength={16} aria-label="Icono"
              onChange={(e) => update(i, { icon: e.target.value })} />
            <input className="input grow" value={card.title} placeholder="Título" aria-label="Título de la tarjeta"
              onChange={(e) => update(i, { title: e.target.value })} />
            <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label="Quitar tarjeta"
              onClick={() => onChange({ cards: value.cards.filter((_, j) => j !== i) })}>×</button>
          </div>
          <textarea className="textarea" value={card.body} placeholder="Mensaje" aria-label="Mensaje de la tarjeta"
            onChange={(e) => update(i, { body: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn--soft btn--sm" style={{ justifySelf: "start" }}
        onClick={() => onChange({ cards: [...value.cards, { icon: "💗", title: "", body: "" }] })}>+ Agregar tarjeta</button>
    </div>
  );
};

const LetterEditor: ContentEditor<"letter"> = ({ value, onChange }) => (
  <div className="stack">
    <Field label="Saludo">{(id) => <input id={id} className="input" value={value.greeting} onChange={(e) => onChange({ ...value, greeting: e.target.value })} />}</Field>
    <ListEditor label="Párrafos" multiline items={value.paragraphs} placeholder="Escribe un párrafo…" onChange={(paragraphs) => onChange({ ...value, paragraphs })} />
    <ListEditor label="Deseos" items={value.wishes} placeholder="✨ Un deseo" onChange={(wishes) => onChange({ ...value, wishes })} />
    <Field label="Firma">{(id) => <input id={id} className="input" value={value.signature} onChange={(e) => onChange({ ...value, signature: e.target.value })} />}</Field>
    <label className="switch">
      <input type="checkbox" role="switch" checked={!!value.surprise}
        onChange={(e) => onChange({ ...value, surprise: e.target.checked ? { button: "Abrir sorpresa", title: "¡Sorpresa!", text: "" } : null })} />
      <span>Incluir botón de sorpresa</span>
    </label>
    {value.surprise && (
      <div className="form-grid">
        <Field label="Texto del botón">{(id) => <input id={id} className="input" value={value.surprise!.button} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, button: e.target.value } })} />}</Field>
        <Field label="Título de la sorpresa">{(id) => <input id={id} className="input" value={value.surprise!.title} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, title: e.target.value } })} />}</Field>
        <Field label="Mensaje sorpresa">{(id) => <textarea id={id} className="textarea" value={value.surprise!.text} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, text: e.target.value } })} />}</Field>
      </div>
    )}
  </div>
);

const TextEditor: ContentEditor<"text"> = ({ value, onChange }) => (
  <Field label="Texto" hint="Deja una línea en blanco para separar párrafos">
    {(id) => <textarea id={id} className="textarea" rows={8} value={value.body} onChange={(e) => onChange({ body: e.target.value })} />}
  </Field>
);

const QuoteEditor: ContentEditor<"quote"> = ({ value, onChange }) => (
  <div className="form-grid">
    <Field label="Frase">{(id) => <textarea id={id} className="textarea" value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />}</Field>
    <Field label="Autor (opcional)">{(id) => <input id={id} className="input" value={value.author} onChange={(e) => onChange({ ...value, author: e.target.value })} />}</Field>
  </div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NoContent = (hint: string): ContentEditor<any> => () => <p className="muted">{hint}</p>;

/** Editor de contenido por tipo (mismo patrón Registry que la página). */
const CONTENT_EDITORS: { [K in SectionKind]: ContentEditor<K> } = {
  hero: NoContent("La portada usa el título y subtítulo de arriba."),
  together_counter: NoContent("El contador usa la fecha de inicio de la relación (Administración → Ajustes)."),
  countdowns: NoContent("Las fechas se gestionan en la sección Fechas importantes."),
  milestones: NoContent("Los hitos se gestionan en la sección Hitos."),
  gallery: NoContent("Las fotos se gestionan en la sección Fotos."),
  love_notes: LoveNotesEditor,
  letter: LetterEditor,
  text: TextEditor,
  quote: QuoteEditor,
};

interface Props {
  section: Section;
  busy: boolean;
  onSave(section: Section): void;
  onCancel(): void;
}

export function SectionEditor({ section, busy, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Section>(section);
  const ContentEditorFor = CONTENT_EDITORS[draft.kind] as ContentEditor<SectionKind>;
  const meta = SECTION_KIND_LABELS[draft.kind];

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <span className="badge" style={{ justifySelf: "start" }}>{meta.icon} {meta.label}</span>
      <div className="form-grid">
        <Field label="Título">{(id) => <input id={id} className="input" maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
        <Field label="Subtítulo">{(id) => <input id={id} className="input" maxLength={400} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />}</Field>
        <Field label="Animación de entrada">
          {(id) => (
            <select id={id} className="select" value={draft.animation} onChange={(e) => setDraft({ ...draft, animation: e.target.value as SectionAnimation })}>
              {SECTION_ANIMATIONS.map((a) => <option key={a} value={a}>{ANIMATION_LABELS[a]}</option>)}
            </select>
          )}
        </Field>
      </div>
      <ContentEditorFor value={draft.content as never} onChange={(content) => setDraft({ ...draft, content } as Section)} />
      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}
