import { Link } from "react-router-dom";
import { parseIsoDate } from "@/domain/dates";
import type { Profile } from "@/domain/types";
import {
  SPECIAL_DAY_IDS, SPECIAL_DAY_STYLES, specialDayOn, type SpecialDayId, type SpecialDaysConfig,
} from "@/domain/specialDays";
import { Field, Switch } from "@/ui/Field";
import { dateFormat } from "@/i18n/store";
import { useT } from "@/i18n";
import styles from "./SpecialDaysCard.module.scss";

interface Props {
  value: SpecialDaysConfig;
  relationshipStart: string | null;
  profiles: Profile[];
  onChange(next: SpecialDaysConfig): void;
}

const dayMonth = (iso: string) => dateFormat({ day: "numeric", month: "long" }).format(parseIsoDate(iso));

/**
 * Tarjeta de Apariencia para las fechas especiales: el cumpleaños de ella
 * (a mano o tomado de su cuenta), qué fechas cambian el tema y un enlace
 * para ver cada tema ya mismo en la página.
 */
export function SpecialDaysCard({ value, relationshipStart, profiles, onChange }: Props) {
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

      <ul className={styles.list}>
        {SPECIAL_DAY_IDS.map((id) => {
          const date = when(id);
          const style = SPECIAL_DAY_STYLES[id];
          const missing = !date ? (id === "birthday" ? t.admin.noBirthday : t.admin.noStart) : null;
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
