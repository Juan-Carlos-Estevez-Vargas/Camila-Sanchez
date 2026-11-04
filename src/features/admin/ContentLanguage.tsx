import { useId } from "react";
import {
  CONTENT_LOCALES, getAt, pruneTranslation, setAt, textLeaves, translationProgress,
  type ContentLocale, type ContentTranslations, type Path,
} from "@/domain/contentTranslations";
import { useT } from "@/i18n";
import { localeInfo } from "@/i18n/locales";

/** Idioma en el que se está editando: el original (es) o una traducción. */
export type EditLanguage = "es" | ContentLocale;

/**
 * Pestañas «Español (original) · English · Português» de los editores del
 * panel. En cada idioma traducido muestra cuántos textos ya tienen traducción.
 */
export function ContentLanguageTabs({ value, onChange, source, translations }: {
  value: EditLanguage;
  onChange(lang: EditLanguage): void;
  source: Record<string, unknown>;
  translations: ContentTranslations | undefined;
}) {
  const t = useT().admin.translate;
  const labelId = useId();
  return (
    <div className="content-lang" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="content-lang__label">{t.language}</span>
      <div className="content-lang__options">
        <button type="button" className="content-lang__option" aria-pressed={value === "es"} onClick={() => onChange("es")}>
          {t.original}
        </button>
        {CONTENT_LOCALES.map((locale) => {
          const { done, total } = translationProgress(source, translations?.[locale]);
          return (
            <button key={locale} type="button" className="content-lang__option" aria-pressed={value === locale}
              lang={localeInfo(locale).tag} onClick={() => onChange(locale)}>
              {localeInfo(locale).name}
              {total > 0 && (
                <span className={`content-lang__progress${done === total ? " is-done" : ""}`} aria-label={t.progressLabel(done, total)}>
                  {done}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Nombre de cada campo traducible, según la última clave de su ruta. */
function useFieldLabel() {
  const i18n = useT();
  const a = i18n.admin;
  const e = a.editor;
  const names: Record<string, string> = {
    title: a.title,
    subtitle: e.subtitle,
    siteTitle: i18n.superAdmin.settings.siteTitle,
    siteSubtitle: i18n.superAdmin.settings.subtitle,
    description: a.milestones.description_,
    message: a.message,
    greeting: e.greeting,
    paragraphs: e.paragraphs,
    wishes: e.wishes,
    signature: e.signature,
    button: e.surpriseButton,
    text: e.text,
    author: e.author,
    body: a.message,
    cards: a.translate.card,
    surprise: a.translate.surprise,
  };
  return (path: Path) => {
    const parts: string[] = [];
    path.forEach((key, i) => {
      if (key === "content") return;
      if (typeof key === "number") {
        parts[parts.length - 1] = `${parts[parts.length - 1] ?? ""} ${key + 1}`;
        return;
      }
      const parent = path[i - 1];
      // Dentro de la sorpresa de la carta, «title» y «text» son los suyos.
      if (parent === "surprise" && key === "title") parts.push(e.surpriseTitle);
      else if (parent === "surprise" && key === "text") parts.push(e.surpriseText);
      else if (path[0] === "content" && key === "text" && path.length === 2) parts.push(e.quote);
      else parts.push(names[key] ?? key);
    });
    return parts.join(" · ");
  };
}

/**
 * Un campo por cada texto del original, con el original a la vista. Lo que
 * se deja vacío se muestra en español en la página.
 */
export function TranslationFields({ locale, source, translations, onChange }: {
  locale: ContentLocale;
  source: Record<string, unknown>;
  translations: ContentTranslations | undefined;
  onChange(translations: ContentTranslations): void;
}) {
  const t = useT().admin.translate;
  const labelOf = useFieldLabel();
  const baseId = useId();
  const leaves = textLeaves(source);
  const current = translations?.[locale];
  const info = localeInfo(locale);

  const update = (path: Path, text: string) => {
    const next = pruneTranslation(setAt(current ?? {}, path, text)) as Record<string, unknown> | undefined;
    const all: ContentTranslations = { ...translations };
    if (next) all[locale] = next;
    else delete all[locale];
    onChange(all);
  };

  if (leaves.length === 0) return <p className="muted">{t.nothing}</p>;

  return (
    <div className="stack translation-fields">
      <p className="muted" style={{ margin: 0 }}>{t.hint}</p>
      {leaves.map((leaf) => {
        const id = `${baseId}-${leaf.path.join("-")}`;
        const value = getAt(current, leaf.path);
        const multiline = leaf.text.length > 80 || leaf.text.includes("\n");
        const props = {
          id,
          lang: info.tag,
          value: typeof value === "string" ? value : "",
          placeholder: leaf.text,
          "aria-describedby": `${id}-original`,
          onChange: (ev: { target: { value: string } }) => update(leaf.path, ev.target.value),
        };
        return (
          <div key={id} className="field translation-field">
            <label className="field__label" htmlFor={id}>{labelOf(leaf.path)}</label>
            <p className="translation-field__original" id={`${id}-original`} lang="es">
              <span className="translation-field__tag">{t.originalLabel}</span> {leaf.text}
            </p>
            {multiline
              ? <textarea className="textarea" rows={Math.min(8, Math.max(3, Math.ceil(leaf.text.length / 70)))} {...props} />
              : <input className="input" {...props} />}
          </div>
        );
      })}
    </div>
  );
}
