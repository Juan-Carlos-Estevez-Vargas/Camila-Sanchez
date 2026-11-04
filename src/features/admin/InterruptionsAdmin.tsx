import { useMemo, useState } from "react";
import { INTERRUPTION_STYLES, type Interruption, type InterruptionStyle } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useContentStore } from "@/state/SiteContentStore";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { useSaver } from "./useSaver";
import { dateFormat, msg, useT } from "@/i18n";

type Draft = Omit<Interruption, "id" | "createdBy"> & { id?: string };

const styleLabel = (style: InterruptionStyle) => msg().admin.surprises.styles[style];

/** datetime-local trabaja en hora local sin zona: convertimos ida y vuelta. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function status(i: Interruption): { label: string; tone: string } {
  const now = Date.now();
  const t = msg().admin.surprises.status;
  if (!i.isActive) return { label: t.paused, tone: "badge--muted" };
  if (Date.parse(i.startsAt) > now) return { label: t.scheduled, tone: "" };
  if (i.endsAt && Date.parse(i.endsAt) <= now) return { label: t.ended, tone: "badge--muted" };
  return { label: t.active, tone: "badge--success" };
}

export default function InterruptionsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const { user } = useAuth();
  const i18n = useT();
  const a = i18n.admin;
  const t = a.surprises;
  const when = dateFormat({ dateStyle: "short", timeStyle: "short" });
  const { data, loading, reload } = useAsync(() => backend.content.listInterruptions("all"), [backend]);
  const { data: profiles } = useAsync(() => backend.users.listProfiles(), [backend]);
  // Una sorpresa siempre es para otra persona: nunca para uno mismo.
  const people = useMemo(() => (profiles ?? []).filter((p) => p.id !== user?.id && p.isActive), [profiles, user?.id]);
  const nameOf = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.displayName ?? i18n.common.someone : t.everyone);
  const newDraft = (): Draft => ({
    title: "", body: "", style: "hearts", startsAt: new Date().toISOString(), endsAt: null, isActive: true, showOnce: true,
    recipientId: people.length === 1 ? people[0]!.id : null,
  });

  const refresh = () => {
    void reload();
    store.refresh("interruptions");
  };

  const save = async () => {
    if (!draft?.title.trim() || !draft.recipientId) return;
    const ok = await run(() => backend.content.saveInterruption(draft), t.saved);
    if (ok) {
      setDraft(null);
      refresh();
    }
  };

  return (
    <AdminPage
      title={t.title}
      description={t.description}
      actions={<button className="btn" disabled={!people.length} onClick={() => setDraft(newDraft())}>{t.add}</button>}
    >
      {loading && !data ? <PageLoader /> : !data?.length ? <EmptyState icon="🎁" title={t.empty}>{people.length ? null : t.needsAnother}</EmptyState> : (
        <div className="list">
          {data.map((i) => {
            const s = status(i);
            return (
              <div key={i.id} className="list__item card">
                <span className="list__icon" aria-hidden>{styleLabel(i.style).split(" ")[0]}</span>
                <span className="grow">
                  <strong>{i.title}</strong> <span className={`badge ${s.tone}`}>{s.label}</span>
                  <span className="muted list__sub">
                    {t.summary(nameOf(i.recipientId), when.format(new Date(i.startsAt)), i.endsAt ? when.format(new Date(i.endsAt)) : null, i.showOnce)}
                  </span>
                </span>
                <button className="btn btn--sm btn--ghost" onClick={() => setDraft(i)}>{a.edit}</button>
                <button className="btn btn--sm btn--ghost" aria-label={a.deleteNamed(i.title)} onClick={async () => {
                  if (await confirm({ title: a.deleteTitle(i.title), confirmLabel: a.delete, danger: true })) {
                    await run(() => backend.content.deleteInterruption(i.id), t.deleted);
                    refresh();
                  }
                }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
      {draft && (
        <Modal title={draft.id ? t.editTitle : t.newTitle} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>{i18n.common.cancel}</button><button className="btn" disabled={busy || !draft.title.trim() || !draft.recipientId} onClick={save}>{a.save}</button></>}>
          <div className="stack">
            <Field label={t.forWhom} hint={t.forWhomHint}>
              {(id) => (
                <select id={id} className="select" required value={draft.recipientId ?? ""} onChange={(e) => setDraft({ ...draft, recipientId: e.target.value || null })}>
                  <option value="" disabled>{t.choose}</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              )}
            </Field>
            <Field label={a.title}>{(id) => <input id={id} className="input" maxLength={160} value={draft.title} placeholder={t.titlePlaceholder} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
            <Field label={a.message}>{(id) => <textarea id={id} className="textarea" maxLength={2000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />}</Field>
            <Field label={t.style}>
              {(id) => (
                <select id={id} className="select" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value as InterruptionStyle })}>
                  {INTERRUPTION_STYLES.map((s) => <option key={s} value={s}>{styleLabel(s)}</option>)}
                </select>
              )}
            </Field>
            <div className="form-grid">
              <Field label={t.from}>{(id) => <input id={id} type="datetime-local" className="input" value={toLocalInput(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: fromLocalInput(e.target.value) ?? new Date().toISOString() })} />}</Field>
              <Field label={t.until}>{(id) => <input id={id} type="datetime-local" className="input" value={toLocalInput(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: fromLocalInput(e.target.value) })} />}</Field>
            </div>
            <Switch label={t.once} checked={draft.showOnce} onChange={(showOnce) => setDraft({ ...draft, showOnce })} />
            <Switch label={t.active} checked={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} />
          </div>
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
