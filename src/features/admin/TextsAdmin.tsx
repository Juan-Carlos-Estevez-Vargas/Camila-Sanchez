import { useState } from "react";
import { sectionKindMeta } from "@/domain/defaults";
import type { Section } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { Modal } from "@/ui/Modal";
import { AdminPage } from "./AdminLayout";
import { SectionEditor } from "./SectionEditor";
import { useSaver } from "./useSaver";
import { useT } from "@/i18n";

/** Panel de Camila: editar textos, tarjetas, carta y animaciones. */
export default function TextsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [editing, setEditing] = useState<Section | null>(null);
  const i18n = useT();
  const t = i18n.admin;

  return (
    <AdminPage title={t.texts.title} description={t.texts.description}>
      <div className="list">
        {content?.sections.map((section) => {
          const meta = sectionKindMeta(section.kind);
          return (
            <button key={section.id} className="list__item card card--interactive" onClick={() => setEditing(section)}>
              <span className="list__icon" aria-hidden>{meta.icon}</span>
              <span className="grow" style={{ textAlign: "left" }}>
                <strong>{section.title || meta.label}</strong>
                <span className="muted list__sub">{meta.label} · {t.animations[section.animation]}{section.isVisible ? "" : ` · ${t.hidden}`}</span>
              </span>
              <span aria-hidden>✎</span>
            </button>
          );
        })}
      </div>
      {editing && (
        <Modal wide title={t.texts.editSection} onClose={() => setEditing(null)}>
          <SectionEditor
            section={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              const saved = await run(() => backend.content.saveSection(draft), t.texts.saved);
              if (saved) {
                setEditing(null);
                store.refresh("sections");
              }
            }}
          />
        </Modal>
      )}
    </AdminPage>
  );
}
