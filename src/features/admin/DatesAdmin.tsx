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

type Draft = Omit<ImportantDate, "id"> & { id?: string };

const SUGGESTIONS: Draft[] = [
  { title: "Tu cumpleaños", eventDate: toIsoDate(new Date()), recursYearly: true, icon: "🎂", message: "", isVisible: true },
  { title: "Nuestro aniversario", eventDate: toIsoDate(new Date()), recursYearly: true, icon: "💞", message: "", isVisible: true },
  { title: "Nuestro próximo viaje", eventDate: toIsoDate(new Date()), recursYearly: false, icon: "✈️", message: "", isVisible: true },
];

export default function DatesAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const dates = content?.dates ?? [];
  const countdowns = new Map(buildCountdowns(dates.map((d) => ({ ...d, isVisible: true }))).map((c) => [c.date.id, c]));

  const save = async () => {
    if (!draft?.title.trim()) return;
    const ok = await run(() => backend.content.saveDate(draft), "Fecha guardada 📅");
    if (ok) {
      setDraft(null);
      store.refresh("dates");
    }
  };

  return (
    <AdminPage
      title="Fechas importantes"
      description="Cumpleaños, aniversarios, viajes… La página muestra cuántos días faltan."
      actions={<button className="btn" onClick={() => setDraft({ ...SUGGESTIONS[0]!, title: "" })}>+ Nueva fecha</button>}
    >
      {dates.length === 0 && <EmptyState icon="📅" title="Aún no hay fechas" />}
      <div className="list">
        {dates.map((d) => {
          const c = countdowns.get(d.id);
          return (
            <div key={d.id} className="list__item card">
              <span className="list__icon" aria-hidden>{d.icon}</span>
              <span className="grow">
                <strong>{d.title}</strong> {!d.isVisible && <span className="badge badge--muted">oculta</span>}
                <span className="muted list__sub">
                  {formatLongDate(d.eventDate)}{d.recursYearly ? " · cada año" : ""} · {c ? countdownLabel(c) : "ya pasó"}
                </span>
              </span>
              <button className="btn btn--sm btn--ghost" onClick={() => setDraft(d)}>Editar</button>
              <button className="btn btn--sm btn--ghost" aria-label={`Borrar ${d.title}`} onClick={async () => {
                if (await confirm({ title: `¿Borrar "${d.title}"?`, confirmLabel: "Borrar", danger: true })) {
                  await run(() => backend.content.deleteDate(d.id), "Fecha borrada");
                  store.refresh("dates");
                }
              }}>🗑</button>
            </div>
          );
        })}
      </div>
      {draft && (
        <Modal title={draft.id ? "Editar fecha" : "Nueva fecha"} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>Cancelar</button><button className="btn" disabled={busy || !draft.title.trim()} onClick={save}>Guardar</button></>}>
          <div className="stack">
            {!draft.id && (
              <div className="row">
                {SUGGESTIONS.map((s) => (
                  <button key={s.title} type="button" className="btn btn--sm btn--soft" onClick={() => setDraft({ ...s, eventDate: draft.eventDate })}>{s.icon} {s.title}</button>
                ))}
              </div>
            )}
            <div className="form-grid">
              <Field label="Icono">{(id) => <input id={id} className="input" maxLength={16} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />}</Field>
              <Field label="Nombre">{(id) => <input id={id} className="input" maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
              <Field label="Fecha" hint={draft.recursYearly ? "Para cumpleaños o aniversarios pon la fecha original: así se cuentan los años." : undefined}>
                {(id) => <input id={id} type="date" className="input" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} />}
              </Field>
            </div>
            <Field label="Mensaje (opcional)">{(id) => <input id={id} className="input" maxLength={500} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />}</Field>
            <Switch label="Se repite cada año" checked={draft.recursYearly} onChange={(recursYearly) => setDraft({ ...draft, recursYearly })} />
            <Switch label="Mostrar en la página" checked={draft.isVisible} onChange={(isVisible) => setDraft({ ...draft, isVisible })} />
          </div>
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
