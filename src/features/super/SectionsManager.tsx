import { useState } from "react";
import { Link } from "react-router-dom";
import { emptySection, SECTION_KIND_LABELS } from "@/domain/defaults";
import { SECTION_KINDS, type Section, type SectionKind } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { SectionEditor } from "@/features/admin/SectionEditor";
import { SortableList } from "@/features/admin/SortableList";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";

/** Crear, ordenar, ocultar y borrar secciones de la página. */
export default function SectionsManager() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [order, setOrder] = useState<Section[] | null>(null);
  const sections = order ?? content?.sections ?? [];
  const refresh = () => store.refresh("sections");

  const add = async (kind: SectionKind) => {
    setAdding(false);
    const created = await run(() => backend.content.saveSection(emptySection(kind, sections.length)), "Sección agregada");
    if (created) {
      refresh();
      setEditing(created);
    }
  };

  return (
    <AdminPage title="Secciones" description="Arma la página como quieras: agrega, ordena, oculta o quita secciones."
      actions={<button className="btn" onClick={() => setAdding(true)}>+ Agregar sección</button>}>
      <SortableList
        items={sections}
        getId={(s) => s.id}
        onReorder={async (items) => {
          setOrder(items);
          await run(() => backend.content.reorder("sections", items.map((s) => s.id)), "Orden guardado");
          refresh();
          setTimeout(() => setOrder(null), 600);
        }}
        render={(s) => {
          const meta = SECTION_KIND_LABELS[s.kind];
          return (
            <div className="list__item card">
              <span className="list__icon" aria-hidden>{meta.icon}</span>
              <span className="grow">
                <strong>{s.title || meta.label}</strong>
                <span className="muted list__sub">{meta.label}</span>
              </span>
              <label className="switch" title="Mostrar u ocultar">
                <input type="checkbox" role="switch" checked={s.isVisible} aria-label={`Mostrar ${s.title}`}
                  onChange={async (e) => {
                    await run(() => backend.content.saveSection({ ...s, isVisible: e.target.checked }));
                    refresh();
                  }} />
              </label>
              <button className="btn btn--sm btn--ghost" onClick={() => setEditing(s)}>Editar</button>
              <button className="btn btn--sm btn--ghost" aria-label={`Borrar ${s.title}`} onClick={async () => {
                if (await confirm({ title: `¿Quitar "${s.title || meta.label}"?`, body: "Se borra la sección y su contenido.", confirmLabel: "Quitar", danger: true })) {
                  await run(() => backend.content.deleteSection(s.id), "Sección quitada");
                  refresh();
                }
              }}>🗑</button>
            </div>
          );
        }}
      />
      <p className="muted">Las fotos, hitos y fechas se gestionan en el <Link to="/panel">panel de contenido</Link>.</p>
      {adding && (
        <Modal wide title="¿Qué quieres agregar?" onClose={() => setAdding(false)}>
          <div className="stats">
            {SECTION_KINDS.map((kind) => (
              <button key={kind} className="stat card card--interactive" style={{ textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => void add(kind)}>
                <span className="stat__icon" aria-hidden>{SECTION_KIND_LABELS[kind].icon}</span>
                <strong>{SECTION_KIND_LABELS[kind].label}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>{SECTION_KIND_LABELS[kind].description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {editing && (
        <Modal wide title="Editar sección" onClose={() => setEditing(null)}>
          <SectionEditor section={editing} busy={busy} onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              if (await run(() => backend.content.saveSection(draft), "Sección guardada")) {
                setEditing(null);
                refresh();
              }
            }} />
        </Modal>
      )}
      {confirmElement}
    </AdminPage>
  );
}
