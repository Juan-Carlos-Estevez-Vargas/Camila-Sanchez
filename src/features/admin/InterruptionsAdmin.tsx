import { useState } from "react";
import { INTERRUPTION_STYLES, type Interruption, type InterruptionStyle } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore } from "@/state/SiteContentStore";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { AdminPage } from "./AdminLayout";
import { useSaver } from "./useSaver";

type Draft = Omit<Interruption, "id"> & { id?: string };

const STYLE_LABELS: Record<InterruptionStyle, string> = {
  modal: "💌 Ventana con mensaje",
  banner: "📣 Franja arriba de la página",
  confetti: "🎉 Confeti + mensaje",
  hearts: "💖 Lluvia de corazones + mensaje",
};

/** datetime-local trabaja en hora local sin zona: convertimos ida y vuelta. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function status(i: Interruption): { label: string; tone: string } {
  const now = Date.now();
  if (!i.isActive) return { label: "pausada", tone: "badge--muted" };
  if (Date.parse(i.startsAt) > now) return { label: "programada", tone: "" };
  if (i.endsAt && Date.parse(i.endsAt) <= now) return { label: "terminada", tone: "badge--muted" };
  return { label: "activa", tone: "badge--success" };
}

export default function InterruptionsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const { data, loading, reload } = useAsync(() => backend.content.listInterruptions("all"), [backend]);

  const refresh = () => {
    void reload();
    store.refresh("interruptions");
  };

  const save = async () => {
    if (!draft?.title.trim()) return;
    const ok = await run(() => backend.content.saveInterruption(draft), "Sorpresa guardada 🎁");
    if (ok) {
      setDraft(null);
      refresh();
    }
  };

  return (
    <AdminPage
      title="Sorpresas (interrupciones)"
      description="Mensajes que aparecen solos al abrir la página durante un tiempo: un “feliz mesiversario”, un “te extraño”…"
      actions={<button className="btn" onClick={() => setDraft({ title: "", body: "", style: "hearts", startsAt: new Date().toISOString(), endsAt: null, isActive: true, showOnce: true })}>+ Nueva sorpresa</button>}
    >
      {loading && !data ? <PageLoader /> : !data?.length ? <EmptyState icon="🎁" title="Aún no hay sorpresas programadas" /> : (
        <div className="list">
          {data.map((i) => {
            const s = status(i);
            return (
              <div key={i.id} className="list__item card">
                <span className="list__icon" aria-hidden>{STYLE_LABELS[i.style].split(" ")[0]}</span>
                <span className="grow">
                  <strong>{i.title}</strong> <span className={`badge ${s.tone}`}>{s.label}</span>
                  <span className="muted list__sub">
                    Desde {new Date(i.startsAt).toLocaleString("es-CO")}{i.endsAt ? ` hasta ${new Date(i.endsAt).toLocaleString("es-CO")}` : ""}{i.showOnce ? " · se muestra una vez" : " · siempre"}
                  </span>
                </span>
                <button className="btn btn--sm btn--ghost" onClick={() => setDraft(i)}>Editar</button>
                <button className="btn btn--sm btn--ghost" aria-label={`Borrar ${i.title}`} onClick={async () => {
                  if (await confirm({ title: `¿Borrar "${i.title}"?`, confirmLabel: "Borrar", danger: true })) {
                    await run(() => backend.content.deleteInterruption(i.id), "Sorpresa borrada");
                    refresh();
                  }
                }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
      {draft && (
        <Modal title={draft.id ? "Editar sorpresa" : "Nueva sorpresa"} onClose={() => setDraft(null)}
          footer={<><button className="btn btn--ghost" onClick={() => setDraft(null)}>Cancelar</button><button className="btn" disabled={busy || !draft.title.trim()} onClick={save}>Guardar</button></>}>
          <div className="stack">
            <Field label="Título">{(id) => <input id={id} className="input" maxLength={160} value={draft.title} placeholder="¡Feliz mesiversario, mi amor!" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />}</Field>
            <Field label="Mensaje">{(id) => <textarea id={id} className="textarea" maxLength={2000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />}</Field>
            <Field label="Estilo">
              {(id) => (
                <select id={id} className="select" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value as InterruptionStyle })}>
                  {INTERRUPTION_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
                </select>
              )}
            </Field>
            <div className="form-grid">
              <Field label="Desde">{(id) => <input id={id} type="datetime-local" className="input" value={toLocalInput(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: fromLocalInput(e.target.value) ?? new Date().toISOString() })} />}</Field>
              <Field label="Hasta (opcional)">{(id) => <input id={id} type="datetime-local" className="input" value={toLocalInput(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: fromLocalInput(e.target.value) })} />}</Field>
            </div>
            <Switch label="Mostrar sólo una vez a cada persona" checked={draft.showOnce} onChange={(showOnce) => setDraft({ ...draft, showOnce })} />
            <Switch label="Activa" checked={draft.isActive} onChange={(isActive) => setDraft({ ...draft, isActive })} />
          </div>
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
