import { useState } from "react";
import { formatLongDate, toIsoDate } from "@/domain/dates";
import type { Milestone } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { EmptyState } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { useSaver } from "./useSaver";
import { useT } from "@/i18n";

type Draft = Omit<Milestone, "id"> & { id?: string };

const empty = (position: number): Draft => ({
  title: "", description: "", happenedOn: toIsoDate(new Date()), icon: "💖", photoId: null, position,
});

export default function MilestonesAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content, photoUrls } = useSiteContent();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const i18n = useT();
  const a = i18n.admin;
  const t = a.milestones;
  const milestones = content?.milestones ?? [];
  const photos = [...(content?.photos ?? [])].sort((a, b) => b.takenOn.localeCompare(a.takenOn));

  const save = async () => {
    if (!draft?.title.trim()) return;
    const ok = await run(() => backend.content.saveMilestone(draft), t.saved);
    if (ok) {
      setDraft(null);
      store.refresh("milestones");
    }
  };

  return (
    <AdminPage
      title={t.title}
      description={t.description}
      actions={<button className="btn" onClick={() => setDraft(empty(milestones.length))}>{t.add}</button>}
    >
      {milestones.length === 0 && <EmptyState icon="🌟" title={t.empty} />}
      <div className="list">
        {milestones.map((m) => (
          <div key={m.id} className="list__item card">
            <span className="list__icon" aria-hidden>{m.icon}</span>
            <span className="grow">
              <strong>{m.title}</strong>
              <span className="muted list__sub">{formatLongDate(m.happenedOn)}</span>
            </span>
            <button className="btn btn--sm btn--ghost" onClick={() => setDraft(m)}>{a.edit}</button>
            <button className="btn btn--sm btn--ghost" aria-label={a.deleteNamed(m.title)} onClick={async () => {
              if (await confirm({ title: a.deleteTitle(m.title), confirmLabel: a.delete, danger: true })) {
                await run(() => backend.content.deleteMilestone(m.id), t.deleted);
                store.refresh("milestones");
              }
            }}>🗑</button>
          </div>
        ))}
      </div>
      {draft && (
        <Modal wide title={draft.id ? t.editTitle : t.newTitle} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>{i18n.common.cancel}</button><button className="btn" disabled={busy || !draft.title.trim()} onClick={save}>{a.save}</button></>}>
          <div className="stack">
            <div className="form-grid">
              <Field label={a.icon}>{(id) => <input id={id} className="input" maxLength={16} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />}</Field>
              <Field label={a.title}>{(id) => <input id={id} className="input" required maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
              <Field label={a.date}>{(id) => <input id={id} type="date" className="input" value={draft.happenedOn} onChange={(e) => setDraft({ ...draft, happenedOn: e.target.value })} />}</Field>
            </div>
            <Field label={t.description_}>{(id) => <textarea id={id} className="textarea" maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}</Field>
            <div className="field">
              <span className="field__label">{t.photo}</span>
              <div className="photo-picker">
                <button type="button" className={`photo-picker__item${draft.photoId ? "" : " is-active"}`} onClick={() => setDraft({ ...draft, photoId: null })}>{t.noPhoto}</button>
                {photos.slice(0, 60).map((p) => {
                  const url = photoUrls.get(p.id)?.thumb;
                  return url ? (
                    <button type="button" key={p.id} className={`photo-picker__item${draft.photoId === p.id ? " is-active" : ""}`} onClick={() => setDraft({ ...draft, photoId: p.id })} aria-label={p.caption || t.photoFallback}>
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
