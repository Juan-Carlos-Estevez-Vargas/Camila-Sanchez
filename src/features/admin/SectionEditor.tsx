import { useState, type ReactNode } from "react";
import { TRANSLATABLE, translatableSource } from "@/domain/contentTranslations";
import { sectionKindMeta } from "@/domain/defaults";
import { SECTION_ANIMATIONS, type LoveNoteCard, type Section, type SectionAnimation, type SectionContentMap, type SectionKind } from "@/domain/types";
import { Field } from "@/ui/Field";
import { msg, useT } from "@/i18n";
import { ContentLanguageTabs, TranslationFields, type EditLanguage } from "./ContentLanguage";

/** Textos del editor en el idioma actual (el editor se vuelve a pintar al cambiarlo). */
const tx = () => msg().admin.editor;

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
          <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label={tx().remove} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn--sm btn--soft" style={{ justifySelf: "start" }} onClick={() => onChange([...items, ""])}>{tx().add}</button>
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
            <input className="input" style={{ width: 64, textAlign: "center" }} value={card.icon} maxLength={16} aria-label={msg().admin.icon}
              onChange={(e) => update(i, { icon: e.target.value })} />
            <input className="input grow" value={card.title} placeholder={msg().admin.title} aria-label={tx().cardTitle}
              onChange={(e) => update(i, { title: e.target.value })} />
            <button type="button" className="btn btn--icon btn--ghost btn--sm" aria-label={tx().removeCard}
              onClick={() => onChange({ cards: value.cards.filter((_, j) => j !== i) })}>×</button>
          </div>
          <textarea className="textarea" value={card.body} placeholder={msg().admin.message} aria-label={tx().cardBody}
            onChange={(e) => update(i, { body: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn--soft btn--sm" style={{ justifySelf: "start" }}
        onClick={() => onChange({ cards: [...value.cards, { icon: "💗", title: "", body: "" }] })}>{tx().addCard}</button>
    </div>
  );
};

const LetterEditor: ContentEditor<"letter"> = ({ value, onChange }) => (
  <div className="stack">
    <Field label={tx().greeting}>{(id) => <input id={id} className="input" value={value.greeting} onChange={(e) => onChange({ ...value, greeting: e.target.value })} />}</Field>
    <ListEditor label={tx().paragraphs} multiline items={value.paragraphs} placeholder={tx().paragraphPlaceholder} onChange={(paragraphs) => onChange({ ...value, paragraphs })} />
    <ListEditor label={tx().wishes} items={value.wishes} placeholder={tx().wishPlaceholder} onChange={(wishes) => onChange({ ...value, wishes })} />
    <Field label={tx().signature}>{(id) => <input id={id} className="input" value={value.signature} onChange={(e) => onChange({ ...value, signature: e.target.value })} />}</Field>
    <label className="switch">
      <input type="checkbox" role="switch" checked={!!value.surprise}
        onChange={(e) => onChange({ ...value, surprise: e.target.checked ? { ...tx().surpriseDefaults, text: "" } : null })} />
      <span>{tx().includeSurprise}</span>
    </label>
    {value.surprise && (
      <div className="form-grid">
        <Field label={tx().surpriseButton}>{(id) => <input id={id} className="input" value={value.surprise!.button} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, button: e.target.value } })} />}</Field>
        <Field label={tx().surpriseTitle}>{(id) => <input id={id} className="input" value={value.surprise!.title} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, title: e.target.value } })} />}</Field>
        <Field label={tx().surpriseText}>{(id) => <textarea id={id} className="textarea" value={value.surprise!.text} onChange={(e) => onChange({ ...value, surprise: { ...value.surprise!, text: e.target.value } })} />}</Field>
      </div>
    )}
  </div>
);

const TextEditor: ContentEditor<"text"> = ({ value, onChange }) => (
  <Field label={tx().text} hint={tx().textHint}>
    {(id) => <textarea id={id} className="textarea" rows={8} value={value.body} onChange={(e) => onChange({ body: e.target.value })} />}
  </Field>
);

const QuoteEditor: ContentEditor<"quote"> = ({ value, onChange }) => (
  <div className="form-grid">
    <Field label={tx().quote}>{(id) => <textarea id={id} className="textarea" value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />}</Field>
    <Field label={tx().author}>{(id) => <input id={id} className="input" value={value.author} onChange={(e) => onChange({ ...value, author: e.target.value })} />}</Field>
  </div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NoContent = (key: keyof ReturnType<typeof tx>["noContent"]): ContentEditor<any> => () => <p className="muted">{tx().noContent[key]}</p>;

/** Editor de contenido por tipo (mismo patrón Registry que la página). */
const CONTENT_EDITORS: { [K in SectionKind]: ContentEditor<K> } = {
  hero: NoContent("hero"),
  together_counter: NoContent("together_counter"),
  countdowns: NoContent("countdowns"),
  milestones: NoContent("milestones"),
  gallery: NoContent("gallery"),
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
  const [lang, setLang] = useState<EditLanguage>("es");
  const source = translatableSource(draft, TRANSLATABLE.section as readonly (keyof Section & string)[]);
  const ContentEditorFor = CONTENT_EDITORS[draft.kind] as ContentEditor<SectionKind>;
  const meta = sectionKindMeta(draft.kind);
  const i18n = useT();
  const a = i18n.admin;

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <span className="badge" style={{ justifySelf: "start" }}>{meta.icon} {meta.label}</span>
      <ContentLanguageTabs value={lang} onChange={setLang} source={source} translations={draft.translations} />
      {lang !== "es" ? (
        <TranslationFields locale={lang} source={source} translations={draft.translations}
          onChange={(translations) => setDraft({ ...draft, translations })} />
      ) : (<>
      <div className="form-grid">
        <Field label={a.title}>{(id) => <input id={id} className="input" maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
        <Field label={a.editor.subtitle}>{(id) => <input id={id} className="input" maxLength={400} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />}</Field>
        <Field label={a.editor.animation}>
          {(id) => (
            <select id={id} className="select" value={draft.animation} onChange={(e) => setDraft({ ...draft, animation: e.target.value as SectionAnimation })}>
              {SECTION_ANIMATIONS.map((anim) => <option key={anim} value={anim}>{a.animations[anim]}</option>)}
            </select>
          )}
        </Field>
      </div>
      <ContentEditorFor value={draft.content as never} onChange={(content) => setDraft({ ...draft, content } as Section)} />
      </>)}
      <div className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>{i18n.common.cancel}</button>
        <button className="btn" disabled={busy}>{busy ? i18n.common.saving : a.save}</button>
      </div>
    </form>
  );
}
