import { useState } from "react";
import { Link } from "react-router-dom";
import { parseIsoDate } from "@/domain/dates";
import type { Profile } from "@/domain/types";
import {
  MAX_BIRTHDAY_MESSAGE, SPECIAL_DAY_IDS, SPECIAL_DAY_STYLES, specialDayOn, type SpecialDayId, type SpecialDaysConfig,
} from "@/domain/specialDays";
import { parseSongLines, SERENATA_SUGGESTIONS, youtubeSearchUrl } from "@/domain/specialMusic";
import { Field, Switch } from "@/ui/Field";
import { dateFormat } from "@/i18n/store";
import { useT } from "@/i18n";
import styles from "./SpecialDaysCard.module.scss";

interface Props {
  value: SpecialDaysConfig;
  /** Inicio para el aniversario; null si falta o si la relación terminó (`ended`). */
  relationshipStart: string | null;
  ended?: boolean;
  profiles: Profile[];
  onChange(next: SpecialDaysConfig): void;
}

/**
 * Las canciones propias de una fecha: un cuadro con un enlace por línea.
 * Guarda sólo los enlaces que sirven y avisa de los que no; el texto
 * escrito se queda tal cual mientras se edita.
 */
function DaySongs({ id, urls, onChange }: { id: SpecialDayId; urls: string[]; onChange(urls: string[]): void }) {
  const t = useT().special.admin;
  const [text, setText] = useState(() => urls.join("\n"));
  const { invalid } = parseSongLines(text);
  return (
    <details className={styles.music}>
      <summary>
        {t.songsSummary} · <span className={styles.when}>{urls.length ? t.usingSongs(urls.length) : `${t.tune}: ${t.tunes[id]}`}</span>
      </summary>
      <Field label={t.songs} hint={t.songsHint} error={invalid.length ? t.invalid(invalid.join(", ")) : undefined}>
        {(fieldId) => (
          <textarea id={fieldId} className="textarea" rows={3} spellCheck={false} placeholder="https://www.youtube.com/watch?v=…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(parseSongLines(e.target.value).urls);
            }} />
        )}
      </Field>
      {id === "birthday" && (
        <div className={styles.serenata}>
          <p>{t.serenata}</p>
          <ul>
            {SERENATA_SUGGESTIONS.map((song) => {
              const added = !!song.url && urls.includes(song.url);
              return (
                <li key={song.title}>
                  {song.url ? (
                    <>
                      <a href={song.url} target="_blank" rel="noopener noreferrer">{`${song.title} · ${song.artist}`}</a>
                      {" "}
                      <button type="button" className="btn btn--sm btn--ghost" disabled={added}
                        onClick={() => {
                          const next = `${text.trim()}${text.trim() ? "\n" : ""}${song.url}`;
                          setText(next);
                          onChange(parseSongLines(next).urls);
                        }}>
                        {added ? t.added : t.add}
                      </button>
                    </>
                  ) : (
                    <a href={youtubeSearchUrl(`${song.title} ${song.artist}`)} target="_blank" rel="noopener noreferrer">
                      {t.search(`${song.title} · ${song.artist}`)}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </details>
  );
}

const dayMonth = (iso: string) => dateFormat({ day: "numeric", month: "long" }).format(parseIsoDate(iso));

/**
 * Tarjeta de Apariencia para las fechas especiales: el cumpleaños de ella
 * (a mano o tomado de su cuenta), qué fechas cambian el tema y un enlace
 * para ver cada tema ya mismo en la página.
 */
export function SpecialDaysCard({ value, relationshipStart, ended = false, profiles, onChange }: Props) {
  const t = useT().special;
  const today = specialDayOn(value, relationshipStart);
  const withBirthday = profiles.filter((p) => p.birthday);
  const set = (patch: Partial<SpecialDaysConfig>) => onChange({ ...value, ...patch });
  const toggle = (id: SpecialDayId, on: boolean) =>
    set({ off: on ? value.off.filter((x) => x !== id) : [...value.off, id] });

  const when = (id: SpecialDayId): string | null => {
    if (id === "birthday") return value.birthday ? dayMonth(value.birthday) : null;
    if (id === "anniversary") return relationshipStart ? dayMonth(relationshipStart) : null;
    return t.admin.when[id];
  };

  return (
    <div className="card stack">
      <h2 style={{ margin: 0, fontSize: "1.25rem" }}>🎉 {t.admin.title}</h2>
      <p className="muted" style={{ margin: 0 }}>{t.admin.hint}</p>
      <Switch label={t.admin.enabled} checked={value.enabled} onChange={(enabled) => set({ enabled })} />
      <Switch label={t.admin.music} checked={value.music} onChange={(music) => set({ music })} />
      <p className="muted" style={{ margin: 0 }}>{t.admin.musicHint}</p>

      <div className="form-grid">
        <Field label={t.admin.birthdayName}>
          {(id) => <input id={id} className="input" maxLength={40} value={value.birthdayName} onChange={(e) => set({ birthdayName: e.target.value })} />}
        </Field>
        <Field label={t.admin.birthday}>
          {(id) => <input id={id} className="input" type="date" value={value.birthday ?? ""} onChange={(e) => set({ birthday: e.target.value || null })} />}
        </Field>
        {withBirthday.length > 0 && (
          <Field label={t.admin.fromAccount}>
            {(id) => (
              <select id={id} className="select" value=""
                onChange={(e) => {
                  const p = withBirthday.find((x) => x.id === e.target.value);
                  if (p) set({ birthday: p.birthday, birthdayName: value.birthdayName || p.displayName });
                }}>
                <option value="">{t.admin.pick}</option>
                {withBirthday.map((p) => <option key={p.id} value={p.id}>{p.displayName} · {dayMonth(p.birthday!)}</option>)}
              </select>
            )}
          </Field>
        )}
      </div>
      <Field label={t.admin.birthdayMessage} hint={t.admin.birthdayMessageHint}>
        {(id) => (
          <textarea id={id} className="textarea" rows={2} maxLength={MAX_BIRTHDAY_MESSAGE} placeholder={t.popup.message}
            value={value.birthdayMessage} onChange={(e) => set({ birthdayMessage: e.target.value })} />
        )}
      </Field>

      <ul className={styles.list}>
        {SPECIAL_DAY_IDS.map((id) => {
          const date = when(id);
          const style = SPECIAL_DAY_STYLES[id];
          const missing = !date ? (id === "birthday" ? t.admin.noBirthday : ended ? t.admin.ended : t.admin.noStart) : null;
          return (
            <li key={id} className={styles.item}
              style={{ background: style.colors.background, color: style.colors.text, borderColor: style.colors.primary }}>
              <span className={styles.icon} aria-hidden>{style.icon}</span>
              <div className={styles.text}>
                <strong>{t.names[id]}</strong>
                <span className={styles.when}>
                  {missing ?? date}
                  {today?.id === id && <> · <b>{t.admin.today}</b></>}
                </span>
              </div>
              <div className={styles.actions}>
                <Link className={styles.preview} style={{ background: style.colors.primary, color: style.colors.primaryContrast }}
                  to={`/?tema=${id}`}>
                  {t.admin.preview}
                </Link>
                <label className={styles.toggle}>
                  <input type="checkbox" role="switch" checked={!value.off.includes(id)} disabled={!value.enabled}
                    onChange={(e) => toggle(id, e.target.checked)} />
                  <span className="visually-hidden">{t.admin.toggle(t.names[id])}</span>
                </label>
              </div>
              {value.music && (
                <DaySongs id={id} urls={value.songs[id] ?? []}
                  onChange={(urls) => {
                    const songs = { ...value.songs };
                    if (urls.length) songs[id] = urls;
                    else delete songs[id];
                    set({ songs });
                  }} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
