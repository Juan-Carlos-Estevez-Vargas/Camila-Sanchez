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
  const milestones = content?.milestones ?? [];
  const photos = [...(content?.photos ?? [])].sort((a, b) => b.takenOn.localeCompare(a.takenOn));

  const save = async () => {
    if (!draft?.title.trim()) return;
    const ok = await run(() => backend.content.saveMilestone(draft), "Hito guardado 🌟");
    if (ok) {
      setDraft(null);
      store.refresh("milestones");
    }
  };

  return (
    <AdminPage
      title="Hitos importantes"
      description="Los momentos que aparecen en la línea de tiempo de nuestra historia."
      actions={<button className="btn" onClick={() => setDraft(empty(milestones.length))}>+ Nuevo hito</button>}
    >
      {milestones.length === 0 && <EmptyState icon="🌟" title="Aún no hay hitos" />}
      <div className="list">
        {milestones.map((m) => (
          <div key={m.id} className="list__item card">
            <span className="list__icon" aria-hidden>{m.icon}</span>
            <span className="grow">
              <strong>{m.title}</strong>
              <span className="muted list__sub">{formatLongDate(m.happenedOn)}</span>
            </span>
            <button className="btn btn--sm btn--ghost" onClick={() => setDraft(m)}>Editar</button>
            <button className="btn btn--sm btn--ghost" aria-label={`Borrar ${m.title}`} onClick={async () => {
              if (await confirm({ title: `¿Borrar "${m.title}"?`, confirmLabel: "Borrar", danger: true })) {
                await run(() => backend.content.deleteMilestone(m.id), "Hito borrado");
                store.refresh("milestones");
              }
            }}>🗑</button>
          </div>
        ))}
      </div>
      {draft && (
        <Modal wide title={draft.id ? "Editar hito" : "Nuevo hito"} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>Cancelar</button><button className="btn" disabled={busy || !draft.title.trim()} onClick={save}>Guardar</button></>}>
          <div className="stack">
            <div className="form-grid">
              <Field label="Icono">{(id) => <input id={id} className="input" maxLength={16} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />}</Field>
              <Field label="Título">{(id) => <input id={id} className="input" required maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
              <Field label="Fecha">{(id) => <input id={id} type="date" className="input" value={draft.happenedOn} onChange={(e) => setDraft({ ...draft, happenedOn: e.target.value })} />}</Field>
            </div>
            <Field label="Descripción">{(id) => <textarea id={id} className="textarea" maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}</Field>
            <div className="field">
              <span className="field__label">Foto (opcional)</span>
              <div className="photo-picker">
                <button type="button" className={`photo-picker__item${draft.photoId ? "" : " is-active"}`} onClick={() => setDraft({ ...draft, photoId: null })}>Sin foto</button>
                {photos.slice(0, 60).map((p) => {
                  const url = photoUrls.get(p.id)?.thumb;
                  return url ? (
                    <button type="button" key={p.id} className={`photo-picker__item${draft.photoId === p.id ? " is-active" : ""}`} onClick={() => setDraft({ ...draft, photoId: p.id })} aria-label={p.caption || "Foto"}>
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
