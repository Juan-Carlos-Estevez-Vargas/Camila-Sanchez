import { useState } from "react";
import { buildCountdowns, countdownLabel, formatLongDate, toIsoDate } from "@/domain/dates";
import type { ImportantDate } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { EmptyState } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { useSaver } from "./useSaver";
import { msg, useT } from "@/i18n";

type Draft = Omit<ImportantDate, "id"> & { id?: string };

const suggestions = (): Draft[] => {
  const t = msg().admin.dates.suggestions;
  return [
    { title: t.birthday, eventDate: toIsoDate(new Date()), recursYearly: true, icon: "🎂", message: "", isVisible: true },
    { title: t.anniversary, eventDate: toIsoDate(new Date()), recursYearly: true, icon: "💞", message: "", isVisible: true },
    { title: t.trip, eventDate: toIsoDate(new Date()), recursYearly: false, icon: "✈️", message: "", isVisible: true },
  ];
};

export default function DatesAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const i18n = useT();
  const a = i18n.admin;
  const t = a.dates;
  const SUGGESTIONS = suggestions();
  const dates = content?.dates ?? [];
  const countdowns = new Map(buildCountdowns(dates.map((d) => ({ ...d, isVisible: true }))).map((c) => [c.date.id, c]));

  const save = async () => {
    if (!draft?.title.trim()) return;
    const ok = await run(() => backend.content.saveDate(draft), t.saved);
    if (ok) {
      setDraft(null);
      store.refresh("dates");
    }
  };

  return (
    <AdminPage
      title={t.title}
      description={t.description}
      actions={<button className="btn" onClick={() => setDraft({ ...SUGGESTIONS[0]!, title: "" })}>{t.add}</button>}
    >
      {dates.length === 0 && <EmptyState icon="📅" title={t.empty} />}
      <div className="list">
        {dates.map((d) => {
          const c = countdowns.get(d.id);
          return (
            <div key={d.id} className="list__item card">
              <span className="list__icon" aria-hidden>{d.icon}</span>
              <span className="grow">
                <strong>{d.title}</strong> {!d.isVisible && <span className="badge badge--muted">{a.hidden}</span>}
                <span className="muted list__sub">
                  {formatLongDate(d.eventDate)}{d.recursYearly ? t.yearly : ""} · {c ? countdownLabel(c) : t.past}
                </span>
              </span>
              <button className="btn btn--sm btn--ghost" onClick={() => setDraft(d)}>{a.edit}</button>
              <button className="btn btn--sm btn--ghost" aria-label={a.deleteNamed(d.title)} onClick={async () => {
                if (await confirm({ title: a.deleteTitle(d.title), confirmLabel: a.delete, danger: true })) {
                  await run(() => backend.content.deleteDate(d.id), t.deleted);
                  store.refresh("dates");
                }
              }}>🗑</button>
            </div>
          );
        })}
      </div>
      {draft && (
        <Modal title={draft.id ? t.editTitle : t.newTitle} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>{i18n.common.cancel}</button><button className="btn" disabled={busy || !draft.title.trim()} onClick={save}>{a.save}</button></>}>
          <div className="stack">
            {!draft.id && (
              <div className="row">
                {SUGGESTIONS.map((s) => (
                  <button key={s.title} type="button" className="btn btn--sm btn--soft" onClick={() => setDraft({ ...s, eventDate: draft.eventDate })}>{s.icon} {s.title}</button>
                ))}
              </div>
            )}
            <div className="form-grid">
              <Field label={a.icon}>{(id) => <input id={id} className="input" maxLength={16} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />}</Field>
              <Field label={t.name}>{(id) => <input id={id} className="input" maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
              <Field label={a.date} hint={draft.recursYearly ? t.yearlyHint : undefined}>
                {(id) => <input id={id} type="date" className="input" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} />}
              </Field>
            </div>
            <Field label={a.messageOptional}>{(id) => <input id={id} className="input" maxLength={500} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />}</Field>
            <Switch label={t.repeats} checked={draft.recursYearly} onChange={(recursYearly) => setDraft({ ...draft, recursYearly })} />
            <Switch label={t.show} checked={draft.isVisible} onChange={(isVisible) => setDraft({ ...draft, isVisible })} />
          </div>
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
