import { useState } from "react";
import { Link } from "react-router-dom";
import { emptySection, sectionKindMeta } from "@/domain/defaults";
import { SECTION_KINDS, type Section, type SectionKind } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { SectionEditor } from "@/features/admin/SectionEditor";
import { SortableList } from "@/features/admin/SortableList";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { Modal } from "@/ui/Modal";
import { useConfirm } from "@/ui/useConfirm";
import { useT } from "@/i18n";

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
  const i18n = useT();
  const t = i18n.superAdmin.sections;
  const refresh = () => store.refresh("sections");

  const add = async (kind: SectionKind) => {
    setAdding(false);
    const created = await run(() => backend.content.saveSection(emptySection(kind, sections.length)), t.added);
    if (created) {
      refresh();
      setEditing(created);
    }
  };

  return (
    <AdminPage title={t.title} description={t.description}
      actions={<button className="btn" onClick={() => setAdding(true)}>{t.add}</button>}>
      <SortableList
        items={sections}
        getId={(s) => s.id}
        onReorder={async (items) => {
          setOrder(items);
          await run(() => backend.content.reorder("sections", items.map((s) => s.id)), t.orderSaved);
          refresh();
          setTimeout(() => setOrder(null), 600);
        }}
        render={(s) => {
          const meta = sectionKindMeta(s.kind);
          return (
            <div className="list__item card">
              <span className="list__icon" aria-hidden>{meta.icon}</span>
              <span className="grow">
                <strong>{s.title || meta.label}</strong>
                <span className="muted list__sub">{meta.label}</span>
              </span>
              <label className="switch" title={t.toggle}>
                <input type="checkbox" role="switch" checked={s.isVisible} aria-label={t.show(s.title)}
                  onChange={async (e) => {
                    await run(() => backend.content.saveSection({ ...s, isVisible: e.target.checked }));
                    refresh();
                  }} />
              </label>
              <button className="btn btn--sm btn--ghost" onClick={() => setEditing(s)}>{i18n.admin.edit}</button>
              <button className="btn btn--sm btn--ghost" aria-label={i18n.admin.deleteNamed(s.title)} onClick={async () => {
                if (await confirm({ title: t.removeTitle(s.title || meta.label), body: t.removeBody, confirmLabel: t.remove, danger: true })) {
                  await run(() => backend.content.deleteSection(s.id), t.removed);
                  refresh();
                }
              }}>🗑</button>
            </div>
          );
        }}
      />
      <p className="muted">{t.managedIn} <Link to="/panel">{t.contentPanel}</Link>.</p>
      {adding && (
        <Modal wide title={t.whatToAdd} onClose={() => setAdding(false)}>
          <div className="stats">
            {SECTION_KINDS.map((kind) => [kind, sectionKindMeta(kind)] as const).map(([kind, meta]) => (
              <button key={kind} className="stat card card--interactive" style={{ textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => void add(kind)}>
                <span className="stat__icon" aria-hidden>{meta.icon}</span>
                <strong>{meta.label}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>{meta.description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {editing && (
        <Modal wide title={t.edit} onClose={() => setEditing(null)}>
          <SectionEditor section={editing} busy={busy} onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              if (await run(() => backend.content.saveSection(draft), t.saved)) {
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
